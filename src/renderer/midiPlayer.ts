// Tiny self-contained MIDI player for the About easter egg (Sekmeht) — a
// hand-rolled Standard-MIDI-File parser + a Web Audio oscillator synth. ZERO npm
// dependencies (respects the v0.15.0 packaging-hygiene rule and the codebase's
// hand-rolled-parser ethos). It renders any bundled .mid as a simple chiptune-ish
// voice (triangle oscillators + a soft envelope), loops it, and starts MUTED (the
// AudioContext only spins up on the first unmute — a user gesture, per autoplay
// policy). A soundfont would sound richer but needs samples/deps; oscillators keep
// it self-contained (and on-brand for a text game client).

export interface MidiNote { time: number; dur: number; midi: number; velocity: number }
export interface MidiEvent { t: number; d: number[] }   // t = seconds; d = raw channel-message bytes
export interface MidiSequence { notes: MidiNote[]; events: MidiEvent[]; duration: number }

// ── Standard MIDI File parser ────────────────────────────────────────────────
export function parseMidi(buffer: ArrayBuffer): MidiSequence {
  const dv = new DataView(buffer)
  let pos = 0
  const byteLen = dv.byteLength
  const readStr = (n: number) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(dv.getUint8(pos++)); return s }
  const readVLQ = () => { let v = 0, b: number; do { b = dv.getUint8(pos++); v = (v << 7) | (b & 0x7f) } while (b & 0x80); return v }

  if (byteLen < 14 || readStr(4) !== 'MThd') return { notes: [], events: [], duration: 0 }
  const headerLen = dv.getUint32(pos); pos += 4
  pos += 2                                   // format (unused)
  const ntracks = dv.getUint16(pos); pos += 2
  const division = dv.getUint16(pos); pos += 2
  pos += headerLen - 6                        // skip any extra header bytes
  // SMPTE timing (MSB set) is unsupported → fall back to a sane ticks-per-quarter.
  const ticksPerQuarter = (division & 0x8000) ? 480 : (division || 480)

  const tempoMap: Array<{ tick: number; us: number }> = [{ tick: 0, us: 500000 }]  // default 120bpm
  const rawNotes: Array<{ s: number; e: number; midi: number; vel: number }> = []
  const rawEvents: Array<{ tick: number; d: number[] }> = []   // all channel-voice messages, for the OS synth

  // A read past the buffer (truncated/malformed final track) would otherwise throw
  // and discard EVERY already-parsed track → total silence. Guard it so we keep
  // whatever parsed cleanly and just stop early.
  try {
  for (let t = 0; t < ntracks; t++) {
    if (pos + 8 > byteLen || readStr(4) !== 'MTrk') break
    const len = dv.getUint32(pos); pos += 4
    const end = Math.min(pos + len, byteLen)
    let tick = 0
    let running = 0
    const active = new Map<number, { s: number; vel: number }>()   // key = channel*128 + note
    while (pos < end) {
      tick += readVLQ()
      let status = dv.getUint8(pos)
      if (status & 0x80) pos++; else status = running               // running status
      const hi = status & 0xf0
      const ch = status & 0x0f
      if (status === 0xff) {                                        // meta event
        const type = dv.getUint8(pos++); const mlen = readVLQ()
        if (type === 0x51 && mlen === 3) {
          tempoMap.push({ tick, us: (dv.getUint8(pos) << 16) | (dv.getUint8(pos + 1) << 8) | dv.getUint8(pos + 2) })
        }
        pos += mlen
      } else if (status === 0xf0 || status === 0xf7) {             // sysex
        pos += readVLQ()
      } else if (hi >= 0x80 && hi <= 0xe0) {                       // channel voice message
        running = status   // ONLY channel messages set running status (meta/sysex cancel it — spec)
        const twoData = hi !== 0xc0 && hi !== 0xd0
        const d1 = dv.getUint8(pos++)
        const d2 = twoData ? dv.getUint8(pos++) : 0
        rawEvents.push({ tick, d: twoData ? [status, d1, d2] : [status, d1] })   // replayed verbatim to the OS synth
        if (hi === 0x90 && d2 > 0) active.set(ch * 128 + d1, { s: tick, vel: d2 })
        else if (hi === 0x90 || hi === 0x80) {                     // note-off (or note-on vel 0) → close the note
          const key = ch * 128 + d1; const a = active.get(key)
          if (a) { rawNotes.push({ s: a.s, e: tick, midi: d1, vel: a.vel }); active.delete(key) }
        }
      } else break                                                 // malformed → stop this track
    }
    // close any notes left hanging at track end
    for (const [key, a] of active) rawNotes.push({ s: a.s, e: tick, midi: key % 128, vel: a.vel })
    pos = end
  }
  } catch { /* truncated/malformed → use what parsed so far */ }

  tempoMap.sort((a, b) => a.tick - b.tick)
  const tickToSec = (tk: number) => {
    let secs = 0, lastTick = 0, us = 500000
    for (const e of tempoMap) {
      if (e.tick > tk) break
      secs += (e.tick - lastTick) * (us / 1e6) / ticksPerQuarter
      lastTick = e.tick; us = e.us
    }
    return secs + (tk - lastTick) * (us / 1e6) / ticksPerQuarter
  }

  const notes: MidiNote[] = []
  let duration = 0
  for (const r of rawNotes) {
    const time = tickToSec(r.s)
    const dur = Math.max(0.05, tickToSec(r.e) - time)
    notes.push({ time, dur, midi: r.midi, velocity: r.vel })
    duration = Math.max(duration, time + dur)
  }
  const events: MidiEvent[] = rawEvents.map(e => ({ t: tickToSec(e.tick), d: e.d })).sort((a, b) => a.t - b.t)
  if (events.length) duration = Math.max(duration, events[events.length - 1].t)
  return { notes, events, duration }
}

// ── Web Audio synth ──────────────────────────────────────────────────────────
// A player exposes just start (un-mute) / mute / dispose. Two implementations:
// MidiOutPlayer routes to the OS synth via Web MIDI (sounds like Media Player);
// MidiSynth is a self-contained oscillator fallback when no MIDI output exists.
export interface MidiPlayback { start(): void | Promise<void>; mute(): void; dispose(): void }

const LOOKAHEAD_S = 1.5   // oscillator scheduler: schedule at most this far ahead
// Web-MIDI events are sent to the OS driver with FUTURE timestamps and can't be
// unsent, so a big window means audio keeps playing ~that long after Mute. Keep
// it short (> TICK_MS so there are no gaps) to bound the trailing sound.
const LOOKAHEAD_MS = 300
const TICK_MS = 200       // scheduler wake interval

export class MidiSynth implements MidiPlayback {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private interval: ReturnType<typeof setInterval> | null = null
  private notes: MidiNote[]         // sorted by time
  private duration: number
  private idx = 0                   // next note to schedule in this loop iteration
  private loopStart = 0             // ctx time of this iteration's t=0
  private disposed = false
  constructor(seq: MidiSequence, private volume = 0.12) {
    this.notes = [...seq.notes].sort((a, b) => a.time - b.time)
    this.duration = Math.max(1, seq.duration)
  }

  private playNote(n: MidiNote, when: number) {
    if (!this.ctx || !this.master) return
    const osc = this.ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 440 * Math.pow(2, (n.midi - 69) / 12)
    const g = this.ctx.createGain()
    const peak = 0.5 * (n.velocity / 127)
    const rel = 0.05
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + 0.006)
    g.gain.setValueAtTime(peak, when + Math.max(0.02, n.dur - rel))
    g.gain.linearRampToValueAtTime(0, when + n.dur)
    osc.connect(g); g.connect(this.master)
    osc.start(when)
    osc.stop(when + n.dur + 0.03)
  }

  // Lookahead scheduler (Chris Wilson's two-clocks pattern) — only ever queues
  // the next ~LOOKAHEAD_S of notes, so a 5,000-note song doesn't spawn thousands
  // of oscillators at once. Loops with a tiny gap at the boundary.
  private tick = () => {
    if (this.disposed || !this.ctx || !this.master || !this.notes.length) return
    const ahead = this.ctx.currentTime + LOOKAHEAD_S
    while (this.idx < this.notes.length) {
      const when = this.loopStart + this.notes[this.idx].time
      if (when > ahead) break
      this.playNote(this.notes[this.idx], Math.max(when, this.ctx.currentTime + 0.02))
      this.idx++
    }
    if (this.idx >= this.notes.length && this.ctx.currentTime >= this.loopStart + this.duration) {
      this.loopStart = this.ctx.currentTime + 0.1   // restart the loop
      this.idx = 0
    }
  }

  /** First call spins up the AudioContext (must be a user gesture) + starts the
   *  scheduler; subsequent calls just un-mute (ramp the master gain back up). */
  async start() {
    if (this.disposed) return
    if (!this.ctx) {
      const AC = window.AudioContext
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      const comp = this.ctx.createDynamicsCompressor()
      this.master.connect(comp); comp.connect(this.ctx.destination)
      this.loopStart = this.ctx.currentTime + 0.15
      this.idx = 0
      this.interval = setInterval(this.tick, TICK_MS)
      this.tick()
    }
    try { await this.ctx.resume() } catch { /* ignore */ }
    this.master!.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03)
  }

  /** Silence without tearing down the scheduler (so un-mute resumes instantly). */
  mute() {
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03)
  }

  dispose() {
    this.disposed = true
    if (this.interval) clearInterval(this.interval)
    this.interval = null
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
  }
}

// ── Web MIDI player (routes the raw events to the OS synth) ───────────────────
// Minimal local Web MIDI shapes — the ambient DOM types for Web MIDI are
// incomplete/inconsistent across TS lib versions, and we only need `send`/`name`.
interface MidiOut { name?: string | null; send(data: number[], timestamp?: number): void }
interface MidiAccessLike { outputs: { values(): IterableIterator<MidiOut> } }
type RequestMIDIAccess = (opts?: { sysex?: boolean }) => Promise<MidiAccessLike>

// A REAL note-on (0x90 with velocity > 0) — the only thing Mute suppresses. A
// 0x90 with velocity 0 is actually a note-OFF, and 0x80 is a note-off; those (and
// program/CC) MUST keep flowing while muted so nothing hangs unreleased.
const isNoteOn = (d: number[]) => (d[0] & 0xf0) === 0x90 && (d[2] ?? 0) > 0

export class MidiOutPlayer implements MidiPlayback {
  private events: MidiEvent[]
  private duration: number
  private idx = 0
  private originMs = 0          // performance.now() at this loop iteration's t=0
  private interval: ReturnType<typeof setInterval> | null = null
  private muted = true
  private disposed = false
  constructor(private out: MidiOut, seq: MidiSequence) {
    this.events = seq.events
    this.duration = Math.max(1, seq.duration)
  }

  private allNotesOff(when?: number) {
    for (let ch = 0; ch < 16; ch++) {
      try { this.out.send([0xb0 | ch, 120, 0], when); this.out.send([0xb0 | ch, 123, 0], when) } catch { /* ignore */ }
    }
  }

  private tick = () => {
    if (this.disposed || !this.events.length) return
    const now = performance.now()
    const ahead = now + LOOKAHEAD_MS
    while (this.idx < this.events.length) {
      const e = this.events[this.idx]
      const when = this.originMs + e.t * 1000
      if (when > ahead) break
      // While muted, keep sending program/controller changes AND note-offs (so
      // instrument state stays correct and nothing hangs); suppress only real
      // note-ONs so no new notes start.
      if (!this.muted || !isNoteOn(e.d)) { try { this.out.send(e.d, Math.max(when, now)) } catch { /* ignore */ } }
      this.idx++
    }
    if (this.idx >= this.events.length && now >= this.originMs + this.duration * 1000) {
      this.allNotesOff()              // release anything the file left hanging before looping
      this.originMs = now + 120       // loop
      this.idx = 0
    }
  }

  start() {
    if (this.disposed) return
    this.muted = false
    if (!this.interval) {
      this.originMs = performance.now() + 150
      this.idx = 0
      this.interval = setInterval(this.tick, TICK_MS)
      this.tick()
    }
  }

  mute() {
    this.muted = true
    this.allNotesOff()
  }

  dispose() {
    this.disposed = true
    if (this.interval) clearInterval(this.interval)
    this.interval = null
    // Silence NOW, and again AFTER the lookahead window — note-ons already queued
    // with future timestamps can't be unsent, so this second pass guarantees no
    // note keeps droning after the About window closes (Sekmeht).
    this.allNotesOff()
    this.allNotesOff(performance.now() + LOOKAHEAD_MS + 60)
  }
}

/** Build the best available player: the OS synth (Web MIDI) if there's an output
 *  port — sounds like Windows Media Player — otherwise our oscillator fallback. */
export async function createMidiPlayer(seq: MidiSequence): Promise<MidiPlayback> {
  try {
    const req = (navigator as unknown as { requestMIDIAccess?: RequestMIDIAccess }).requestMIDIAccess
    if (req && seq.events.length) {
      const access = await req.call(navigator, { sysex: false })
      const outs = Array.from(access.outputs.values())
      // Prefer the Windows GS Wavetable Synth; else any available output.
      const out = outs.find(o => /wavetable|microsoft gs|synth/i.test(o.name ?? '')) ?? outs[0]
      if (out) return new MidiOutPlayer(out, seq)
    }
  } catch { /* fall through to the oscillator synth */ }
  return new MidiSynth(seq)
}

/** Load a bundled binary via XHR arraybuffer — works on Electron's file:// origin
 *  (where fetch of a same-origin file resource is unreliable). */
export function loadArrayBuffer(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.onload = () => (xhr.response instanceof ArrayBuffer ? resolve(xhr.response) : reject(new Error('empty')))
    xhr.onerror = () => reject(new Error('load failed'))
    xhr.send()
  })
}
