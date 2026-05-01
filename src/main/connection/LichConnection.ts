import * as net from 'net'
import * as cp from 'child_process'
import { EventEmitter } from 'events'

// Client ID string — Lich with --genie flag expects this format
const CLIENT_ID = 'FE:WRAYTH /VERSION:1.0.1.22 /P:WIN_UNKNOWN /XML'
const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 11024
const LAUNCH_WAIT_MS = 5000

export class LichConnection extends EventEmitter {
  private socket: net.Socket | null = null
  private lichProcess: cp.ChildProcess | null = null
  private buffer = ''
  private connected = false

  async launch(rubyPath: string, lichPath: string, mode = '--stormfront'): Promise<void> {
    return new Promise((resolve, reject) => {
      // Lich is launched via cmd /C so it gets its own console and doesn't
      // block our process. The mode flag tells Lich which client handshake to expect.
      this.lichProcess = cp.spawn('cmd', [
        '/C', rubyPath, lichPath, mode, '--dragonrealms'
      ], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false  // show Lich's own window so user can see its status
      })

      this.lichProcess.on('error', reject)
      this.lichProcess.unref() // don't hold our process open if Lich outlives us

      // Give Lich time to start its proxy listener and authenticate with Simutronics
      setTimeout(resolve, LAUNCH_WAIT_MS)
    })
  }

  async connect(loginKey: string, port = DEFAULT_PORT, host = DEFAULT_HOST): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket()
      this.socket.setEncoding('utf8')

      this.socket.connect(port, host, () => {
        this.connected = true

        // Genie handshake: send the SGE login key then the client ID string.
        // Lich uses the key to establish the real game connection on our behalf.
        this.socket!.write(loginKey + '\n')
        this.socket!.write(CLIENT_ID + '\n')

        resolve()
      })

      this.socket.on('error', (err) => {
        if (!this.connected) reject(new Error(
          `Could not connect to Lich on ${host}:${port}. ` +
          `Is Lich running? Error: ${err.message}`
        ))
        else this.emit('error', err)
      })

      this.socket.on('data', (data: string) => {
        this.buffer += data
        this.flush()
      })

      this.socket.on('close', () => {
        this.connected = false
        this.emit('disconnect')
      })
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
