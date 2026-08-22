import { defineConfig } from 'orval';

export default defineConfig({
  futhub: {
    input: '../../apps/api/openapi.json',
    output: {
      client: 'fetch',
      mode: 'single',
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: { path: './src/request.ts', name: 'request', extension: '.js' },
      },
      target: './src/generated.ts',
    },
  },
});
