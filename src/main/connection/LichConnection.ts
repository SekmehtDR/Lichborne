import * as net from 'net'
import * as cp from 'child_process'
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
  // Tail of Lich's stderr (hidden-window mode only) — surfaced in the error
  // message when Lich crashes on startup.
  private stderrTail = ''

  // Spawn the Lich ruby process. Resolves once the process has spawned (or
  // rejects if the spawn itself fails — e.g. a bad ruby path). Does NOT wait
  // for Lich to be *ready* — connectWithRetry() is the readiness gate.
  async launch(rubyPath: string, lichPath: string, mode = '--stormfront', hideWindow = false): Promise<void> {
    this.exitInfo = null
    this.stderrTail = ''
    this.buffer = ''
    this.connected = false

    return new Promise((resolve, reject) => {
      let settled = false
      const args = [lichPath, mode, '--dragonrealms']

      try {
        if (hideWindow) {
          // Direct spawn, no console window. stderr is piped so a Ruby/Lich
          // startup crash can be surfaced in the error message.
          this.lichProcess = cp.spawn(rubyPath, args, {
            detached: true,
            stdio: ['ignore', 'ignore', 'pipe'],
            windowsHide: true,
          })
        } else {
          // Shell spawn — cmd.exe gives Lich its own visible console window
          // (a direct spawn from a GUI process has no console to show in).
          this.lichProcess = cp.spawn(rubyPath, args, {
            detached: true,
            stdio: 'ignore',
            shell: true,
            windowsHide: false,
          })
        }
      } catch (err) {
        reject(err as Error)
        return
      }

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

      proc.stderr?.on('data', (chunk: Buffer) => {
        // Keep only the tail — enough to show the actual error, bounded.
        this.stderrTail = (this.stderrTail + chunk.toString()).slice(-800)
      })

      // Don't let Lich keep our process alive — it's meant to outlive us.
      proc.unref()

      // Safety net: if 'spawn' never fires, resolve anyway — connectWithRetry
      // is the real readiness check.
      setTimeout(() => { if (!settled) { settled = true; resolve() } }, SPAWN_FALLBACK_MS)
    })
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
    const tail = this.stderrTail.trim()
    return `Lich exited during startup (code ${info.code ?? '?'}).` +
           (tail ? ` Output: ${tail.slice(-300)}` : ' Check the Ruby and Lich paths.')
  }

  // Best-effort kill of the spawned Lich. Used when the connection FAILED so a
  // dead/hung Lich doesn't squat the front-end port for the next character in
  // the launch queue. After a SUCCESSFUL connection Lich is deliberately left
  // running — it's the proxy, and it's meant to outlive us.
  killProcess() {
    try { this.lichProcess?.kill() } catch { /* already gone */ }
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
