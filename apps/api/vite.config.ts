import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'scripts/**/*.test.mjs'],
    fileParallelism: false,
    isolate: true,
  },
});
