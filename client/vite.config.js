// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    dedupe: ['react', 'react-dom'], // ⭐ quan trọng
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'], // ép Vite quy về 1 bản
  },
});
