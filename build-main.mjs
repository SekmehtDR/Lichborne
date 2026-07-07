import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  // Matches the Node bundled in the current Electron (43 → Node 24). Bump in
  // lockstep with Electron majors (check: ELECTRON_RUN_AS_NODE=1 electron -p
  // process.versions.node).
  target: 'node24',
  external: ['electron', 'better-sqlite3'],
  sourcemap: true,
}

await build({
  ...common,
  entryPoints: ['src/main/main.ts'],
  outfile: 'dist/main/main.js',
})

await build({
  ...common,
  entryPoints: ['src/main/preload.ts'],
  outfile: 'dist/main/preload.js',
})

console.log('Main process built successfully.')
