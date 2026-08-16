import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API base is injected at build/runtime via VITE_API_BASE (see .env.example).
// In dev we proxy /api to the Nest server so there are no CORS surprises.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
