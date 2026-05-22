import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    // Source maps — lets the DevTools performance profiler resolve minified
    // names (Lx, Pu, kj…) back to real functions. Temporary debugging aid;
    // revert to false before release if bundle/.map size is a concern.
    sourcemap: true,
    rollupOptions: {
      output: {
        // Avoid crossorigin attribute which breaks Electron file:// loading
        format: 'iife',
        inlineDynamicImports: true
      }
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  }
})
