import * as net from 'net'
import { EventEmitter } from 'events'
import { LichConnection } from './LichConnection'
import { SGEConnection } from './SGEConnection'
import type { LoginCredentials } from '../../shared/types'

const CLIENT_ID = 'FE:WRAYTH /VERSION:1.0.1.22 /P:WIN_UNKNOWN /XML'

// ── Lich launch serialization ────────────────────────────────────────────────
// A Lich process serves exactly ONE front-end, then closes its listening
// socket (verified in Lich's main.rb — `listener.accept` then `listener.close`).
// Multiple characters therefore reuse the same front-end port *sequentially*.
// This module-level chain (shared across every per-session ConnectionManager)
// ensures only one character is in the spawn→connect window at a time, so two
// Lich instances never contend for the port — which on Windows can otherwise
// cross-wire connections under SO_REUSEADDR.
let lichLaunchChain: Promise<unknown> = Promise.resolve()
function serializeLichLaunch<T>(task: () => Promise<T>): Promise<T> {
  // `.then(task, task)` runs the next task whether the previous one resolved
  // or rejected — one character's failure must not block the queue.
  const result = lichLaunchChain.then(task, task)
  lichLaunchChain = result.then(() => undefined, () => undefined)
  return result
}

export class ConnectionManager extends EventEmitter {
  private lich = new LichConnection()
  private sge = new SGEConnection()
  private gameSocket: net.Socket | null = null
  private mode: 'lich' | 'direct' = 'lich'
  private buffer = ''

  constructor() {
    super()
    // Wire Lich events once — not inside connectViaLich to avoid stacking listeners
    this.lich.on('line', (line: string) => this.emit('line', line))
    this.lich.on('disconnect', () => this.emit('disconnect'))
    this.lich.on('error', (err: Error) => this.emit('error', err))
  }

  async connectViaLich(creds: LoginCredentials): Promise<void> {
    this.mode = 'lich'

    // SGE auth is independent of Lich — start it now so it overlaps the time
    // this character may spend waiting behind another character's Lich launch.
    // The noop .catch marks the promise handled so a rejection while we're
    // still queued isn't reported as unhandled; the task below still awaits
    // (and re-throws) the real rejection.
    const loginKeyPromise = this.authenticateSge(creds)
    void loginKeyPromise.catch(() => { /* surfaced by the awaited task */ })

    try {
      await serializeLichLaunch(async () => {
        // Resolve SGE auth first. If it failed (bad password, unknown
        // character) we bail HERE — before spawning Lich — so a failed login
        // never leaves an orphaned Lich process squatting the port.
        const loginKey = await loginKeyPromise

        this.emit('status', 'Launching Lich...')
        // creds.character names the per-session launch log file (Logs/lich-launch/).
        await this.lich.launch(creds.rubyPath, creds.lichPath, creds.lichMode, creds.lichArguments, creds.character)

        this.emit('status', `Waiting for Lich on localhost:${creds.lichPort}...`)
        await this.lich.connectWithRetry(loginKey, creds.lichPort, {
          // 30s cap — covers a slow Ruby init + Lich listener bind on every
          // machine we've tested. A user-facing knob existed before v0.8.0
          // (`lichDelay`) but the connect-with-retry loop made it pointless;
          // bumping this constant is the escape hatch if anyone ever needs it.
          maxWaitMs: 30_000,
          onProgress: (s) => this.emit('status', `Waiting for Lich to start... (${s}s)`),
        })
      })
    } catch (err) {
      // The connection failed — kill the Lich we spawned (if any) so it does
      // not hold the front-end port against the next character in the queue.
      this.lich.killProcess()
      throw err
    }

    this.emit('status', 'Connected via Lich')
  }

  // eaccess.play.net authentication — yields the per-character login key Lich
  // needs for the Genie handshake. No Lich involvement, so it runs outside the
  // launch queue (and overlaps the queue wait for later characters).
  //
  // `creds.game` is threaded through to `sge.authenticate` (v0.8.0) so the
  // login key is for the right shard. Until v0.8.0 this call passed only
  // account/password — SGEConnection defaulted gameCode to 'DR', so even DRT/
  // DRX/DRF characters got a DR login key and were silently routed there.
  private async authenticateSge(creds: LoginCredentials): Promise<string> {
    this.emit('status', 'Connecting to eaccess.play.net:7910...')
    await this.sge.connect()
    try {
      this.emit('status', 'SGE connected — authenticating...')
      const characters = await this.sge.authenticate(creds.account, creds.password, creds.game)

      const char = characters.find(
        c => c.name.toLowerCase() === creds.character.toLowerCase()
      )
      if (!char) {
        const names = characters.map(c => c.name).join(', ')
        throw new Error(`Character "${creds.character}" not found. Available: ${names}`)
      }

      this.emit('status', `Getting login key for ${char.name}...`)
      const loginResult = await this.sge.getLoginKey(char.key)
      return loginResult.loginKey
    } finally {
      this.sge.disconnect()
    }
  }

  async connectDirect(creds: LoginCredentials): Promise<void> {
    this.mode = 'direct'
    this.emit('status', 'Authenticating with Simutronics...')

    await this.sge.connect()
    // creds.game threaded through (v0.8.0) — see authenticateSge above for why.
    const characters = await this.sge.authenticate(creds.account, creds.password, creds.game)

    const char = characters.find(
      c => c.name.toLowerCase() === creds.character.toLowerCase()
    )
    if (!char) {
      const names = characters.map(c => c.name).join(', ')
      throw new Error(`Character "${creds.character}" not found. Available: ${names}`)
    }

    const loginResult = await this.sge.getLoginKey(char.key)
    this.sge.disconnect()

    this.emit('status', `Connecting to ${loginResult.gameHost}:${loginResult.gamePort}...`)
    await this.connectToGameServer(
      loginResult.gameHost,
      loginResult.gamePort,
      loginResult.loginKey
    )
    this.emit('status', 'Connected directly to DragonRealms')
  }

  private async connectToGameServer(host: string, port: number, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gameSocket = new net.Socket()
      this.gameSocket.setEncoding('utf8')
      let handshakeDone = false

      this.gameSocket.connect(port, host, () => {
        this.gameSocket!.write(key + '\n')
        this.gameSocket!.write(CLIENT_ID + '\n')
        resolve()
      })

      this.gameSocket.on('error', (err) => {
        if (!handshakeDone) reject(err)
        else this.emit('error', err)
      })

      this.gameSocket.on('data', (data: string) => {
        // First data from the game server is the "Please wait..." prompt.
        // Respond with \n\n to complete the handshake, matching Genie behavior.
        if (!handshakeDone) {
          handshakeDone = true
          setTimeout(() => this.gameSocket?.write('\n\n'), 500)
        }
        this.buffer += data
        this.flushLines()
      })

      this.gameSocket.on('close', () => this.emit('disconnect'))
    })
  }

  send(command: string) {
    if (this.mode === 'lich') {
      this.lich.send(command)
    } else {
      this.gameSocket?.write(command + '\r\n')
    }
  }

  // Graceful disconnect. Default behavior: send QUIT, wait up to 5s for the
  // server-side disconnect ack, then force-close. Used by the in-tab
  // Disconnect button and the conflict-modal auto-disconnect path — both
  // care about the server actually releasing the account slot before the
  // next action (especially the conflict-modal, which immediately retries
  // a login on the same account).
  //
  // `quickClose: true` (v0.8.0, B99) skips the ack-wait. Used by the app
  // shutdown path — the user wants the window gone NOW. We use **socket
  // half-close** (`socket.end()`) so the QUIT is GUARANTEED to leave our
  // process: end() writes the queued bytes, then sends FIN after the send
  // buffer drains. (The earlier cut used `write + 300ms + destroy`, which
  // was a race against the OS send queue — fine on Lich loopback but not
  // guaranteed for the Direct internet socket. With end() both paths are
  // bytes-out-the-door guaranteed; we just don't wait for the server ack.)
  // v0.8.1: cap tightened from 1500ms → 500ms. Loopback Lich 'close' fires
  // in ~1–10ms; Direct internet sockets ~50–150ms; 500ms is the paranoid
  // safety net for the rare case the OS never reports 'close' at all.
  async gracefulDisconnect(opts: { quickClose?: boolean } = {}): Promise<void> {
    this.send('QUIT')

    if (opts.quickClose) {
      await this.endActiveSocket(500)
      this.forceDisconnect()
      return
    }

    await new Promise<void>((resolve) => {
      const forceClose = setTimeout(() => resolve(), 5000)
      // Resolve early if the game closes the connection itself.
      this.once('disconnect', () => {
        clearTimeout(forceClose)
        resolve()
      })
    })
    this.forceDisconnect()
  }

  // Half-close the active session socket via socket.end() and wait for the
  // OS-level 'close' event (capped by `timeoutMs`). Routes to the Lich
  // helper for Lich sessions or directly to the game socket for Direct.
  // Used only by the quickClose path in gracefulDisconnect above.
  private async endActiveSocket(timeoutMs: number): Promise<void> {
    if (this.mode === 'lich') {
      await this.lich.endAndAwaitClose(timeoutMs)
    } else if (this.gameSocket) {
      const sock = this.gameSocket
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, timeoutMs)
        sock.once('close', () => { clearTimeout(timer); resolve() })
        sock.end()
      })
    }
  }

  forceDisconnect() {
    this.lich.disconnect()
    this.gameSocket?.destroy()
    this.gameSocket = null
    this.sge.disconnect()
  }

  private flushLines() {
    // Single-pass: walk a cursor over the buffer slicing each line once, then
    // drop the consumed prefix in one final assignment. The previous form
    // re-sliced `this.buffer` from index 0 per line — O(K·N) for a chunk with
    // K lines in N chars, which combat spam can make large.
    let start = 0
    let idx: number
    while ((idx = this.buffer.indexOf('\n', start)) !== -1) {
      this.emit('line', this.buffer.slice(start, idx + 1))
      start = idx + 1
    }
    if (start > 0) this.buffer = this.buffer.slice(start)
  }
}
