import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiUrl = process.env.PLAYER_API_URL ?? 'http://localhost:3000';
// Activity em dev: Discord acessa o Vite por túnel HTTPS (ex.: `.trycloudflare.com`).
const tunnelHosts = process.env.PLAYER_ALLOWED_HOSTS?.split(',').filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: tunnelHosts,
    hmr: tunnelHosts?.length ? { clientPort: 443 } : undefined,
    proxy: { '/v1': { target: apiUrl, changeOrigin: true } },
  },
});
