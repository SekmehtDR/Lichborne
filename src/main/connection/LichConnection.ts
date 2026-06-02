import * as net from 'net'
import * as cp from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { EventEmitter } from 'events'

// Client ID string — Lich with --genie flag expects this format
const CLIENT_ID = 'FE:WRAYTH /VERSION:1.0.1.22 /P:WIN_UNKNOWN /XML'
const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 11024

// Connect-with-retry tuning. Lich's startup time is variable (Ruby init, ~40
// requires, the listener bind — which itself retries if the port is busy), so
// a fixed delay can't predict readiness. Instead we retry the real connection
// until Lich's front-end port accepts it.
const RETRY_INTERVAL_MS  = 250
const DEFAULT_MAX_WAIT_MS = 30_000
// Safety net for launch() if the 'spawn' event never arrives.
const SPAWN_FALLBACK_MS  = 1500

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Sanitize a character name into a safe per-session log filename (mirrors the
// safeName used by sessionLog.ts). Empty → 'lich'.
const safeName = (name: string) => (name || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'lich'

interface ExitInfo {
  code: number | null
  signal: NodeJS.Signals | null
  error?: Error
}

export interface ConnectRetryOptions {
  maxWaitMs?: number
  /** Called roughly once per second while waiting, with elapsed whole seconds. */
  onProgress?: (elapsedSeconds: number) => void
}

export class LichConnection extends EventEmitter {
  private socket: net.Socket | null = null
  private lichProcess: cp.ChildProcess | null = null
  private buffer = ''
  private connected = false
  // Set if the spawned Lich process errors or exits — connectWithRetry checks
  // this so a dead Lich fails fast instead of retrying the port for 30s.
  private exitInfo: ExitInfo | null = null
  // Path of the per-session launch log (Lich's stdout+stderr is redirected here
  // instead of a pipe — see launch()). describeExit() reads its tail when Lich
  // crashes on startup.
  private logPath = ''

  // Spawn the Lich ruby process. Resolves once the process has spawned (or
  // rejects if the spawn itself fails — e.g. a bad ruby path). Does NOT wait
  // for Lich to be *ready* — connectWithRetry() is the readiness gate.
  //
  // `lichArguments` is the per-shard CLI flag string from DEFAULT_GAMES — e.g.
  // '--dragonrealms', '--test --dragonrealms', '--platinum --dragonrealms',
  // '--fallen'. Until v0.8.0 this was hardcoded to '--dragonrealms', which
  // silently routed DRT / DRX / DRF characters to DR.
  //
  // SPAWN SHAPE (v0.9.x — GTK-friendly launch). Lich runs as a normal Windows
  // GUI-subsystem process so Ruby/GTK scripts (`;vars setup`, kill-counter, …)
  // get a proper process/desktop context and their windows render + pump
  // reliably. This is the community-standard shape (matches how Frostbite /
  // Genie launch Lich). Three things make it work:
  //   1. We run `rubyw.exe` (GUI subsystem), not `ruby.exe` (console). Derived
  //      from the configured ruby path via resolveRubyw(); falls back to the
  //      given path if rubyw.exe isn't present.
  //   2. No `windowsHide` — rubyw is windowless by nature, so there's no stray
  //      console to hide, and we don't impose a hidden-window context on GTK.
  //   3. No stderr PIPE. The previous shape piped stderr for crash diagnostics,
  //      but a redirected console pipe is exactly the kind of non-GUI process
  //      context that made GTK flaky. Instead Lich's stdout+stderr go to a
  //      per-session log file ({userData}/Logs/lich-launch/{Character}.log);
  //      describeExit() reads its tail when a launch fails.
  // `detached` + `unref()` are kept (Lich is the proxy and must outlive us),
  // as is the child handle (so a Lich that dies on startup fails fast via
  // exitInfo rather than waiting out the 30s connect-retry).
  async launch(
    rubyPath: string,
    lichPath: string,
    mode = '--stormfront',
    lichArguments = '--dragonrealms',
    character = 'lich',
  ): Promise<void> {
    this.exitInfo = null
    this.buffer = ''
    this.connected = false

    const rubywPath = this.resolveRubyw(rubyPath)

    // Open the per-session launch log (truncate per launch → bounded size,
    // holds only the latest session). Per-character filename so concurrent
    // sessions never interleave into one file. Best-effort: if we can't open
    // it, fall back to discarding output rather than failing the launch.
    let logFd: number | null = null
    try {
      const logDir = path.join(app.getPath('userData'), 'Logs', 'lich-launch')
      fs.mkdirSync(logDir, { recursive: true })
      this.logPath = path.join(logDir, `${safeName(character)}.log`)
      logFd = fs.openSync(this.logPath, 'w')
    } catch {
      this.logPath = ''
      logFd = null
    }

    return new Promise((resolve, reject) => {
      let settled = false
      const args = [lichPath, mode, ...lichArguments.trim().split(/\s+/)]

      try {
        // GUI-subsystem spawn: rubyw, no hidden-window flag, stdout+stderr to a
        // log file (not a pipe). See the SPAWN SHAPE note above.
        this.lichProcess = cp.spawn(rubywPath, args, {
          detached: true,
          stdio: logFd === null ? 'ignore' : ['ignore', logFd, logFd],
        })
      } catch (err) {
        if (logFd !== null) { try { fs.closeSync(logFd) } catch { /* ignore */ } }
        reject(err as Error)
        return
      }

      // The child has its own dup of the fd now; close our copy so we don't
      // leak it (the file stays open in the child for the session's lifetime).
      if (logFd !== null) { try { fs.closeSync(logFd) } catch { /* ignore */ } }

      const proc = this.lichProcess

      proc.on('error', (err) => {
        // Spawn failure (bad path) or a process-level error.
        this.exitInfo = { code: null, signal: null, error: err }
        if (!settled) { settled = true; reject(err) }
      })

      // If Lich exits before we connect, connectWithRetry will see this and
      // fail fast. (A post-connection exit is just a normal disconnect.)
      proc.on('exit', (code, signal) => {
        this.exitInfo = { code, signal }
      })

      proc.on('spawn', () => {
        if (!settled) { settled = true; resolve() }
      })

      // Don't let Lich keep our process alive — it's meant to outlive us.
      proc.unref()

      // Safety net: if 'spawn' never fires, resolve anyway — connectWithRetry
      // is the real readiness check.
      setTimeout(() => { if (!settled) { settled = true; resolve() } }, SPAWN_FALLBACK_MS)
    })
  }

  // Derive the GUI-subsystem interpreter (rubyw.exe) from the configured
  // console interpreter path (ruby.exe). Falls back to the given path if the
  // derived rubyw.exe doesn't exist — or if the path is already rubyw.exe (the
  // /ruby\.exe$/ anchor won't match "...rubyw.exe", so it's used verbatim).
  private resolveRubyw(rubyPath: string): string {
    const derived = rubyPath.replace(/ruby\.exe$/i, 'rubyw.exe')
    return (derived !== rubyPath && fs.existsSync(derived)) ? derived : rubyPath
  }

  // Connect to Lich's front-end port, retrying until it accepts. The first
  // successful attempt IS the session connection — no throwaway probe sockets,
  // which matters because Lich's listener accepts exactly one front-end and
  // then closes (a connect-then-disconnect probe could confuse it).
  async connectWithRetry(loginKey: string, port = DEFAULT_PORT, opts: ConnectRetryOptions = {}): Promise<void> {
    const maxWaitMs = opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS
    const start = Date.now()
    const deadline = start + maxWaitMs
    let lastReportedSecond = -1

    for (;;) {
      if (this.exitInfo) throw new Error(this.describeExit())

      try {
        await this.connect(loginKey, port)
        return
      } catch (err) {
        if (this.exitInfo) throw new Error(this.describeExit())

        const code = (err as NodeJS.ErrnoException).code
        const retryable = code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT'
        if (!retryable) throw err

        if (Date.now() >= deadline) {
          throw new Error(
            `Lich did not open port ${port} within ${Math.round(maxWaitMs / 1000)}s. ` +
            `Check the Ruby and Lich paths, and that Lich isn't blocked by antivirus.`
          )
        }

        const sec = Math.floor((Date.now() - start) / 1000)
        if (sec !== lastReportedSecond) {
          lastReportedSecond = sec
          opts.onProgress?.(sec)
        }
        await delay(RETRY_INTERVAL_MS)
      }
    }
  }

  // One connection attempt + Genie handshake. Rejects with the raw socket
  // error (preserving `.code`) so connectWithRetry can classify it. The
  // live-session listeners (data / close / error) are wired only AFTER a
  // successful connect, so a failed attempt's socket never emits 'disconnect'.
  private connect(loginKey: string, port: number, host = DEFAULT_HOST): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      socket.setEncoding('utf8')

      const onPreConnectError = (err: Error) => {
        socket.destroy()
        reject(err)
      }
      socket.once('error', onPreConnectError)

      socket.connect(port, host, () => {
        socket.removeListener('error', onPreConnectError)
        this.socket = socket
        this.connected = true

        socket.on('error', (err) => this.emit('error', err))
        socket.on('data', (data: string) => {
          this.buffer += data
          this.flush()
        })
        socket.on('close', () => {
          this.connected = false
          this.emit('disconnect')
        })

        // Genie handshake: send the SGE login key then the client ID string.
        // Lich uses the key to establish the real game connection on our behalf.
        socket.write(loginKey + '\n')
        socket.write(CLIENT_ID + '\n')
        resolve()
      })
    })
  }

  // Human-readable reason a launch failed, for the connect log.
  private describeExit(): string {
    const info = this.exitInfo
    if (!info) return 'Lich is not running.'
    if (info.error) {
      return `Could not start Lich: ${info.error.message}. Check the Ruby and Lich paths.`
    }
    // Lich's stdout+stderr is redirected to the launch log (see launch()), so
    // pull the tail from there for the error banner instead of an in-memory pipe.
    const tail = this.readLogTail().trim()
    return `Lich exited during startup (code ${info.code ?? '?'}).` +
           (tail ? ` Output: ${tail}` : ' Check the Ruby and Lich paths.')
  }

  // Best-effort read of the last ~300 chars of the launch log, for describeExit.
  private readLogTail(): string {
    if (!this.logPath) return ''
    try {
      return fs.readFileSync(this.logPath, 'utf8').slice(-300)
    } catch {
      return ''
    }
  }

  // Best-effort kill of the spawned Lich. Used when the connection FAILED so a
  // dead/hung Lich doesn't squat the front-end port for the next character in
  // the launch queue. After a SUCCESSFUL connection Lich is deliberately left
  // running — it's the proxy, and it's meant to outlive us.
  killProcess() {
    try { this.lichProcess?.kill() } catch { /* already gone */ }
  }

  // v0.8.0 (B99 quickClose path): graceful TCP half-close. Calls socket.end()
  // which writes any pending bytes from our OS send buffer, then sends FIN
  // after the buffer drains. The other end (Lich) sees a clean half-close
  // with our QUIT delivered, processes it, and then drops its game socket.
  // We wait for the 'close' event (or timeout) so the caller knows the
  // bytes left our process. Way more reliable than `write + setTimeout +
  // destroy` because we're not racing the OS send queue.
  async endAndAwaitClose(timeoutMs: number): Promise<void> {
    const sock = this.socket
    if (!sock) return
    return new Promise<void>(resolve => {
      const timer = setTimeout(resolve, timeoutMs)
      sock.once('close', () => { clearTimeout(timer); resolve() })
      sock.end()
    })
  }

  send(command: string) {
    if (this.connected && this.socket) {
      this.socket.write(command + '\r\n')
    }
  }

  disconnect() {
    this.socket?.destroy()
    this.socket = null
    this.connected = false
  }

  get isConnected() {
    return this.connected
  }

  private flush() {
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx + 1)
      this.buffer = this.buffer.slice(idx + 1)
      this.emit('line', line)
    }
  }
}
