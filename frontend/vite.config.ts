import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/simulate': 'http://localhost:8000',
      '/operator': 'http://localhost:8000',
      '/ai': 'http://localhost:8000',
      '/ddto': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
