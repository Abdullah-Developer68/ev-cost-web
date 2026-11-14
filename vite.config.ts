import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset URLs, so the build works from any sub-path on a static host.
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [react()],
  build: {
    target: 'es2022',
    // exceljs is ~900 kB minified; it is loaded on demand, never in the first paint.
    chunkSizeWarningLimit: 1000
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}']
  }
})
