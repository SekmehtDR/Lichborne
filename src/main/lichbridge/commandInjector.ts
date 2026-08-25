// CommandInjector — the `;command` vocabulary Lichborne sends to Lich (script control).
//
// A stateless formatter (the Ruby `frozen_string_literal` idea — pure command
// injection, no state of its own): each method builds one Lich console command
// (`;listall`, `;pause X`, `;unpause X`, `;kill X`, `;name [args]`) and hands
// it to the `send` callback it was constructed with. LichBridge (./index.ts)
// owns the one instance per session, bound to that session's connection send,
// so a command reaches the correct character's Lich process.
//
// Know before adding a method: whatever is sent here goes down the SAME socket
// as typed input, so Lich's scripts (upstream hooks) see it exactly as if the
// player typed it — there is no "synthetic" side channel. Don't add anything
// that would be injected unprompted; the auto-poll is gated for exactly this
// reason (see pollScriptList in ./index.ts and pitfall #76).
export class CommandInjector {
  constructor(private send: (cmd: string) => void) {}

  pollScriptList()                        { this.send(';listall') }
  pauseScript(name: string)               { this.send(`;pause ${name}`) }
  resumeScript(name: string)              { this.send(`;unpause ${name}`) }
  killScript(name: string)                { this.send(`;kill ${name}`) }
  startScript(name: string, args?: string) {
    this.send(args ? `;${name} ${args}` : `;${name}`)
  }
}
