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
