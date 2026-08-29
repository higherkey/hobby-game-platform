import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@games': path.resolve(__dirname, './src/games'),
      '@client': path.resolve(__dirname, './src/client')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          engine: ['boardgame.io']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
