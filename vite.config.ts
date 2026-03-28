import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor'
          }

          if (id.includes('/react-router-dom/') || id.includes('/react-router/')) {
            return 'router-vendor'
          }

          if (id.includes('/@tauri-apps/')) {
            return 'tauri-vendor'
          }

          if (id.includes('/lucide-react/')) {
            return 'icons-vendor'
          }

          if (id.includes('/pinyin-pro/')) {
            return 'search-vendor'
          }

          if (id.includes('/sonner/')) {
            return 'feedback-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    host: host || undefined,
    port: 1420,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
