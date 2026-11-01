// Temporary: the dev server on 5174 against a Tapcue server on 4100 (not committed).
import base from './vite.config';
const SERVER = 'http://localhost:4100';
export default {
  ...base,
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    proxy: {
      '/api': SERVER,
      '/assets': SERVER,
      '/demo/': SERVER,
      '/ws': { target: SERVER, ws: true },
    },
  },
};
