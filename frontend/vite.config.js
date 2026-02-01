import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:6391',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:6391',
        ws: true,
      },
      '/preview': {
        target: 'http://127.0.0.1:6391',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
