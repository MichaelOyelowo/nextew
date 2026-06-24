import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const perRouteHeaders = {
  name: 'per-route-headers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/remove-bg')) {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      }
      next()
    })
  }
}

export default defineConfig({
  plugins: [react(), perRouteHeaders],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      // COEP intentionally removed — applied only on /remove-bg above
    }
  }
})