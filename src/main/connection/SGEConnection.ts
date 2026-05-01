import * as tls from 'tls'
import { EventEmitter } from 'events'
import type { CharacterEntry } from '../../shared/types'

const SGE_HOST = 'eaccess.play.net'
const SGE_PORT = 7910
const READ_TIMEOUT_MS = 5000

export interface SGELoginResult {
  gameHost: string
  gamePort: number
  loginKey: string
}

export class SGEConnection extends EventEmitter {
  private socket: tls.TLSSocket | null = null
  private buffer = ''

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy()
        reject(new Error('Timed out connecting to eaccess.play.net:7910'))
      }, READ_TIMEOUT_MS)

      this.socket = tls.connect({
        host: SGE_HOST,
        port: SGE_PORT,
        rejectUnauthorized: false,
      }, () => {
        clearTimeout(timer)
        resolve()
      })

      this.socket.setEncoding('binary')
      this.socket.on('data', (data: string) => {
        this.buffer += data
      })
      this.socket.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`SGE connection error: ${err.message}`))
      })
    })
  }

  async authenticate(account: string, password: string): Promise<CharacterEntry[]> {
    // Step 1: Send K, read exactly 32 bytes
    this.send('K\r\n')
    const key = await this.readBytes(32)

    const encrypted = this.encryptPassword(key, password)
    this.send(`A\t${account.toUpperCase()}\t${encrypted}`)

    const authRaw = await this.readRaw()
    if (!authRaw.includes('\tKEY\t')) {
      throw new Error(`Authentication failed: ${authRaw.trim()}`)
    }

    this.send('G\tDR')
    const gRaw = await this.readRaw(200)
    if (gRaw.toUpperCase() === 'PROBLEM') {
      throw new Error('Account has a problem — check play.net for details')
    }

    this.send('C')
    const charLine = await this.readRaw(300)

    return this.parseCharacterList(charLine)
  }

  async getLoginKey(characterKey: string): Promise<SGELoginResult> {
    // Send L (no terminator), raw read — response may span multiple lines
    this.send(`L\t${characterKey}\tSTORM`)
    const response = await this.readRaw(300)

    const result: Partial<SGELoginResult> = {}
    for (const line of response.split(/[\r\n\t]/)) {
      if (line.startsWith('GAMEHOST=')) result.gameHost = line.slice(9).trim()
      else if (line.startsWith('GAMEPORT=')) result.gamePort = parseInt(line.slice(9).trim(), 10)
      else if (line.startsWith('KEY=')) result.loginKey = line.slice(4).replace(/\0/g, '').trim()
    }

    if (!result.gameHost || !result.gamePort || !result.loginKey) {
      throw new Error(`Incomplete login response: ${JSON.stringify(result)}`)
    }
    return result as SGELoginResult
  }

  disconnect() {
    this.socket?.destroy()
    this.socket = null
    this.buffer = ''
  }

  private send(data: string) {
    this.socket?.write(data, 'binary')
  }

  // Read exactly `count` bytes
  private readBytes(count: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + READ_TIMEOUT_MS
      const check = () => {
        if (Date.now() > deadline) { reject(new Error(`Timed out waiting for ${count} bytes`)); return }
        if (this.buffer.length >= count) {
          const result = this.buffer.slice(0, count)
          this.buffer = this.buffer.slice(count)
          resolve(result)
        } else {
          this.socket?.once('data', check)
        }
      }
      check()
    })
  }

  // Read whatever arrives within `settleMs` after first byte — for responses with no newline guarantee
  private readRaw(settleMs = 150): Promise<string> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + READ_TIMEOUT_MS

      const flush = () => {
        const data = this.buffer.replace(/\0/g, '').trim()
        this.buffer = ''
        resolve(data)
      }

      const check = () => {
        if (Date.now() > deadline) { reject(new Error('Timed out waiting for SGE response')); return }
        if (this.buffer.length > 0) {
          // Wait settleMs to collect any follow-up bytes in the same response
          setTimeout(flush, settleMs)
        } else {
          this.socket?.once('data', check)
        }
      }
      check()
    })
  }

  // Read until \r or \n — for C and L responses which are newline-terminated
  private readUntilNewline(): Promise<string> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + READ_TIMEOUT_MS
      const sb: string[] = []

      const check = () => {
        if (Date.now() > deadline) { reject(new Error('Timed out waiting for newline from SGE')); return }

        const crIdx = this.buffer.indexOf('\r')
        const lfIdx = this.buffer.indexOf('\n')
        const idx = crIdx === -1 ? lfIdx : lfIdx === -1 ? crIdx : Math.min(crIdx, lfIdx)

        if (idx !== -1) {
          sb.push(this.buffer.slice(0, idx))
          this.buffer = this.buffer.slice(idx + 1)
          // Skip paired \r\n
          if (this.buffer[0] === '\n' || this.buffer[0] === '\r') {
            this.buffer = this.buffer.slice(1)
          }
          resolve(sb.join('').replace(/\0/g, '').trim())
        } else {
          // No newline yet — take what's here and wait for more
          if (this.buffer.length > 0) {
            sb.push(this.buffer)
            this.buffer = ''
          }
          this.socket?.once('data', check)
        }
      }
      check()
    })
  }

  // XOR cipher matching Simutronics spec
  private encryptPassword(key: string, password: string): string {
    const result: number[] = []
    for (let i = 0; i < password.length; i++) {
      result.push(((password.charCodeAt(i) - 32) ^ key.charCodeAt(i)) + 32)
    }
    return String.fromCharCode(...result)
  }

  private parseCharacterList(line: string): CharacterEntry[] {
    // Response format: C\t<count>\t<maxslots>\t<unk>\t<unk>\tKEY1\tNAME1\tKEY2\tNAME2...
    // Skip the 5-token header before character key-name pairs begin
    const parts = line.split('\t')
    const HEADER_FIELDS = 5
    const characters: CharacterEntry[] = []
    for (let i = HEADER_FIELDS; i + 1 < parts.length; i += 2) {
      if (parts[i] && parts[i + 1]) {
        characters.push({ key: parts[i], name: parts[i + 1] })
      }
    }
    return characters
  }
}
