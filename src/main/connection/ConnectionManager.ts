import * as net from 'net'
import { EventEmitter } from 'events'
import { LichConnection } from './LichConnection'
import { SGEConnection } from './SGEConnection'
import type { LoginCredentials } from '../../shared/types'

const CLIENT_ID = 'FE:WRAYTH /VERSION:1.0.1.22 /P:WIN_UNKNOWN /XML'

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

    this.emit('status', 'Launching Lich...')
    const lichLaunchPromise = this.lich.launch(creds.rubyPath, creds.lichPath)

    this.emit('status', 'Connecting to eaccess.play.net:7910...')
    await this.sge.connect()

    this.emit('status', 'SGE connected — requesting encryption key...')
    const characters = await this.sge.authenticate(creds.account, creds.password)
    this.emit('status', `Got ${characters.length} character(s): ${characters.map(c => c.name).join(', ')}`)

    const char = characters.find(
      c => c.name.toLowerCase() === creds.character.toLowerCase()
    )
    if (!char) {
      const names = characters.map(c => c.name).join(', ')
      throw new Error(`Character "${creds.character}" not found. Available: ${names}`)
    }

    this.emit('status', `Getting login key for ${char.name}...`)
    const loginResult = await this.sge.getLoginKey(char.key)
    this.emit('status', `Login key received. Game server: ${loginResult.gameHost}:${loginResult.gamePort}`)
    this.sge.disconnect()

    this.emit('status', 'Waiting for Lich to finish starting...')
    await lichLaunchPromise

    this.emit('status', `Connecting to Lich on localhost:${creds.lichPort}...`)
    await this.lich.connect(loginResult.loginKey, creds.lichPort)
    this.emit('status', 'Connected via Lich')
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
