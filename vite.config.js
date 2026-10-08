import { defineConfig } from 'vite';

// In dev, /api is proxied to the Node server (npm start) so AI chat works with `npm run dev` too.
export default defineConfig({
  server: { proxy: { '/api': `http://localhost:${process.env.API_PORT || 8080}` } },
  build: { chunkSizeWarningLimit: 2000 },
});
