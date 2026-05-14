// frozen_string_literal equivalent — pure command-injection only, no state
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
