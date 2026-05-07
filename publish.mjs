import { build } from 'electron-builder'
import { readFileSync } from 'fs'

const releaseNotes = readFileSync('release-notes.md', 'utf-8')

await build({
  publish: 'always',
  config: {
    releaseInfo: { releaseNotes }
  }
})
