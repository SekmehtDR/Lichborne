import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
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
