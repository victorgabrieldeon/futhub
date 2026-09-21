import ttsc from '@ttsc/unplugin/vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [ttsc()],
  test: {
    exclude: [...configDefaults.exclude, 'scripts/**/*.test.mjs'],
    fileParallelism: false,
    isolate: true,
  },
});
