/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/observations': 'http://localhost:8000',
      '/actions': 'http://localhost:8000',
      '/inspections': 'http://localhost:8000',
      '/kpi': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/audit': 'http://localhost:8000',
      '/alerts': 'http://localhost:8000',
      '/ocr': 'http://localhost:8000',
      '/sync': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
});
