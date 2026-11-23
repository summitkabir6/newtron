import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Backend origin for the dev proxy. Defaults to a local backend;
  // docker-compose sets VITE_PROXY_TARGET to the backend service.
  const env = loadEnv(mode, '.', '')
  const target = env.VITE_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/simulate': target,
        '/operator': target,
        '/ai': target,
        '/ddto': target,
        '/ws': { target: target.replace(/^http/, 'ws'), ws: true },
      },
    },
  }
})
