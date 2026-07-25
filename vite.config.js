import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/

/** Không in log `[vite] http proxy error` (timeout BE / mạng) — tránh spam terminal. */
function shouldMuteViteProxyError(args) {
  const text = args.map((a) => String(a)).join('\n')
  return text.includes('http proxy error')
}

const originalConsoleError = console.error.bind(console)
console.error = (...args) => {
  if (shouldMuteViteProxyError(args)) return
  originalConsoleError(...args)
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://wdp-be-a2qb.onrender.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
        timeout: 120_000,
        proxyTimeout: 120_000,
        configure: (proxy) => {
          // Nuốt error event để giảm noise; Vite vẫn có thể log — đã mute ở console.error.
          proxy.on('error', () => {})
        },
      },
    },
  },
})
