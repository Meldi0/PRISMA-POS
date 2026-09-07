import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (!res.headersSent) {
              res.writeHead(503, {
                'Content-Type': 'application/json; charset=utf-8'
              });
              res.end(JSON.stringify({
                status: 'error',
                code: 503,
                message: 'Backend API PRISMA POS (port 5001) tidak merespons. Pastikan npm run server berjalan.'
              }));
            }
          });
        }
      }
    }
  }
});
