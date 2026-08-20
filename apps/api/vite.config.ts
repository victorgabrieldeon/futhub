import ttsc from '@ttsc/unplugin/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [ttsc()],
  test: {
    fileParallelism: false,
    isolate: true,
  },
});
