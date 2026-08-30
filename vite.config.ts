import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@games': fileURLToPath(new URL('./src/games', import.meta.url)),
      '@client': fileURLToPath(new URL('./src/client', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor';
          }
          if (id.includes('node_modules/boardgame.io')) {
            return 'engine';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/games': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  test: {
    exclude: ['**/e2e/**', '**/node_modules/**']
  }
});
