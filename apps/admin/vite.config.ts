import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiUrl = process.env.ADMIN_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/v1/admin': { target: apiUrl, changeOrigin: true },
    },
  },
});
