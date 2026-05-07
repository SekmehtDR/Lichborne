import { build } from 'electron-builder'
import { readFileSync } from 'fs'

const releaseNotes = readFileSync('release-notes.md', 'utf-8')

await build({
  publish: 'always',  // 'always' | 'onTag' | 'onTagOrDraft' | 'never'
  config: {
    // Override the version from package.json — useful for a hotfix without editing package.json
    // extraMetadata: { version: '0.1.2' },

    releaseInfo: {
      // The markdown body of the GitHub release. Read from file above.
      releaseNotes,

      // Custom release title — defaults to the version string (e.g. "0.1.1") if omitted
      // releaseName: 'v0.1.1 — Timestamps & Title Bar',
    },

    publish: {
      // GitHub release type: 'draft' (default) | 'prerelease' | 'release'
      // 'draft' means you review and publish manually on GitHub before it goes live
      releaseType: 'draft',
    },

    win: {
      // Path to a .ico file — defaults to build/icon.ico if present, otherwise Electron default
      // icon: 'build/icon.ico',

      // Output filename pattern — tokens: ${productName}, ${version}, ${arch}
      // artifactName: '${productName}-${version}.exe',
    },
  },
})
