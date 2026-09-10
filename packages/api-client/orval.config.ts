import { defineConfig } from 'orval';

export default defineConfig({
  futhub: {
    input: {
      target: '../../apps/api/openapi.json',
      // ponytail: JSON mutator cannot consume SSE; chat owns progressive transport until SDK supports streams.
      filters: {
        mode: 'exclude',
        tags: ['Administração / Assistente IA streaming'],
        includeUnreferencedSchemas: true,
      },
    },
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
