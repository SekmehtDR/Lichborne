import { build } from 'electron-builder'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const version = pkg.version
const tag = `v${version}`
const releaseNotes = readFileSync('release-notes.md', 'utf-8')
const token = process.env.GH_TOKEN
const owner = 'SekmehtDR'
const repo = 'Lichborne'

if (!token) {
  console.error('GH_TOKEN env var is not set.')
  process.exit(1)
}

// Step 1: compile main + renderer so __APP_VERSION__ and app.getVersion() reflect the new version
console.log('Building main and renderer...')
execSync('npm run build', { stdio: 'inherit' })

// Step 2: package and publish via electron-builder (creates draft, uploads exe + latest.yml)
console.log(`Packaging and publishing ${tag}...`)
await build({
  publish: 'always',
  config: {
    // Uncomment to override per-release without editing package.json:
    // win: { icon: 'build/icon.ico', artifactName: '${productName}-${version}.exe' },
    // extraMetadata: { version: '0.1.2' },
    // publish: { releaseType: 'prerelease' },
  },
})

// Step 3: find the draft release electron-builder just created and set the release body
console.log('Patching release notes...')
const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
  headers: { Authorization: `token ${token}`, 'User-Agent': 'publish.mjs' },
})
if (!listRes.ok) {
  console.error('Failed to list releases:', await listRes.text())
  process.exit(1)
}

const releases = await listRes.json()
const draft = releases.find(r => r.tag_name === tag && r.draft)
if (!draft) {
  console.error(`Could not find draft release for ${tag}. Was it created by electron-builder?`)
  process.exit(1)
}

const patchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${draft.id}`, {
  method: 'PATCH',
  headers: {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'publish.mjs',
  },
  body: JSON.stringify({ body: releaseNotes }),
})
if (!patchRes.ok) {
  console.error('Failed to patch release notes:', await patchRes.text())
  process.exit(1)
}

console.log(`Done. Draft release ${tag} is ready — go to GitHub and click Publish.`)
