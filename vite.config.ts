import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5176,
    // Two apps open at once must not fight over the same port.
    strictPort: true,
    // In development the page and the API must share an origin, otherwise the
    // browser blocks the call: the services only allow http://localhost:5173
    // and :3000, not this port. Proxying /api to the same host the deployed
    // site uses keeps the request paths identical in dev and production
    // (/api/user/auth/login), so nothing is rewritten for the app's benefit.
    proxy: {
      '/api': { target: 'http://localhost', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('axios')) return 'vendor-http'
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
          return undefined
        },
      },
    },
  },
})
