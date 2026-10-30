// Vite builds and serves the web app; Vitest reads the same file, so tests use the same plugins.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** The Tapcue server in development (packages/server, default port 4000). */
const SERVER = 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same origin for the browser in development as in production: the web app and the API.
    proxy: {
      '/api': SERVER,
      '/assets': SERVER,
      // The demo receiver's endpoint, /demo/<screen>/<content>. The trailing slash keeps the
      // web app's own page /demo out of the proxy.
      '/demo/': SERVER,
      '/ws': { target: SERVER, ws: true },
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
