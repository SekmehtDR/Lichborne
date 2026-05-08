import { build } from 'electron-builder'
import { readFileSync, readdirSync, rmSync } from 'fs'
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

// Step 1: clean release/ so no leftover files from prior runs get picked up
console.log('Cleaning release folder...')
for (const f of readdirSync('release')) {
  if (f.endsWith('.exe') || f.endsWith('.yml')) {
    rmSync(`release/${f}`)
    console.log(`  deleted release/${f}`)
  }
}

// Step 2: compile main + renderer so __APP_VERSION__ and app.getVersion() reflect the new version
console.log('Building main and renderer...')
execSync('npm run build', { stdio: 'inherit' })

// Step 3: package and publish via electron-builder
// NSIS builds generate latest.yml automatically — no manual generation needed
console.log(`Packaging and publishing ${tag}...`)
await build({ publish: 'always' })

// Step 4: find the draft release electron-builder created and patch release notes
console.log('Finding draft release...')
const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
  headers: { Authorization: `token ${token}`, 'User-Agent': 'publish.mjs' },
})
if (!listRes.ok) { console.error('Failed to list releases:', await listRes.text()); process.exit(1) }

const releases = await listRes.json()
const draft = releases.find(r => r.tag_name === tag && r.draft)
if (!draft) { console.error(`No draft release found for ${tag}.`); process.exit(1) }

// Step 5: patch release notes
console.log('Patching release notes...')
const patchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${draft.id}`, {
  method: 'PATCH',
  headers: {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'publish.mjs',
  },
  body: JSON.stringify({ body: releaseNotes }),
})
if (!patchRes.ok) { console.error('Failed to patch release notes:', await patchRes.text()); process.exit(1) }

console.log(`Done. Draft release ${tag} is ready — go to GitHub and click Publish.`)
