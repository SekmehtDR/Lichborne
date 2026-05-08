import { build } from 'electron-builder'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { createHash } from 'crypto'

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

// Step 2: package and publish via electron-builder (creates draft release, uploads exe)
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

// Step 3: generate latest.yml manually (electron-builder doesn't produce it for portable builds)
console.log('Generating latest.yml...')
const exeFile = readdirSync('release').find(f => f.endsWith('.exe') && f.includes(version))
if (!exeFile) { console.error(`No exe for v${version} found in release/`); process.exit(1) }

const exeBuffer = readFileSync(`release/${exeFile}`)
const sha512 = createHash('sha512').update(exeBuffer).digest('base64')
const size = statSync(`release/${exeFile}`).size
const releaseDate = new Date().toISOString()

const latestYml = `version: ${version}
files:
  - url: ${exeFile}
    sha512: ${sha512}
    size: ${size}
path: ${exeFile}
sha512: ${sha512}
releaseDate: '${releaseDate}'
`
writeFileSync('release/latest.yml', latestYml)

// Step 4: find the draft release electron-builder created and upload latest.yml + patch notes
console.log('Finding draft release...')
const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
  headers: { Authorization: `token ${token}`, 'User-Agent': 'publish.mjs' },
})
if (!listRes.ok) { console.error('Failed to list releases:', await listRes.text()); process.exit(1) }

const releases = await listRes.json()
const draft = releases.find(r => r.tag_name === tag && r.draft)
if (!draft) { console.error(`No draft release found for ${tag}.`); process.exit(1) }

console.log('Uploading latest.yml...')
const ymlBuffer = Buffer.from(latestYml, 'utf-8')
const uploadRes = await fetch(
  `https://uploads.github.com/repos/${owner}/${repo}/releases/${draft.id}/assets?name=latest.yml`,
  {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/octet-stream',
      'User-Agent': 'publish.mjs',
    },
    body: ymlBuffer,
  }
)
if (!uploadRes.ok) { console.error('Failed to upload latest.yml:', await uploadRes.text()); process.exit(1) }

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
