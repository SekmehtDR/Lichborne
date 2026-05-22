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
        await this.lich.launch(creds.rubyPath, creds.lichPath, creds.lichMode, creds.hideLichWindow)

        this.emit('status', `Waiting for Lich on localhost:${creds.lichPort}...`)
        await this.lich.connectWithRetry(loginKey, creds.lichPort, {
          // lichDelay is repurposed as a timeout floor — most users keep the
          // default; a slow machine can raise it. Never below 30s.
          maxWaitMs: Math.max(creds.lichDelay, 30) * 1000,
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
  private async authenticateSge(creds: LoginCredentials): Promise<string> {
    this.emit('status', 'Connecting to eaccess.play.net:7910...')
    await this.sge.connect()
    try {
      this.emit('status', 'SGE connected — authenticating...')
      const characters = await this.sge.authenticate(creds.account, creds.password)

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
    const characters = await this.sge.authenticate(creds.account, creds.password)

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

  async gracefulDisconnect(): Promise<void> {
    // Send QUIT and wait for the server to close the connection.
    // DR will process the logout and drop the connection on its own.
    this.send('QUIT')

    await new Promise<void>((resolve) => {
      const forceClose = setTimeout(() => {
        resolve()
      }, 5000)

      // Resolve early if the game closes the connection itself
      this.once('disconnect', () => {
        clearTimeout(forceClose)
        resolve()
      })
    })

    this.forceDisconnect()
  }

  forceDisconnect() {
    this.lich.disconnect()
    this.gameSocket?.destroy()
    this.gameSocket = null
    this.sge.disconnect()
  }

  private flushLines() {
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx + 1)
      this.buffer = this.buffer.slice(idx + 1)
      this.emit('line', line)
    }
  }
}
