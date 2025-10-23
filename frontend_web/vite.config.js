import { defineConfig } from 'vite';
import path from 'path';

// Vite config for the simple frontend app used during development.
export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  },
  server: {
    port: 5174,
    open: false
  }
});
