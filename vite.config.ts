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
