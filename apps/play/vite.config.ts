import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiUrl = process.env.PLAYER_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    proxy: { '/v1': { target: apiUrl, changeOrigin: true } },
  },
});
