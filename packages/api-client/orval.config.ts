import { defineConfig } from 'orval';

// Tags become folder names (tags-split): keep them ASCII, e.g. "Administração / Cards" → administracao-cards.
function asciiTag(tag: string): string {
  return tag.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export default defineConfig({
  futhub: {
    input: {
      target: '../../apps/api/openapi.json',
      // ponytail: JSON mutator cannot consume SSE; chat owns progressive transport until SDK supports streams.
      filters: {
        mode: 'exclude',
        // Filters run after the transformer, so they see ASCII tag names.
        tags: ['Administracao / Assistente IA streaming'],
        includeUnreferencedSchemas: true,
      },
      override: {
        transformer: (spec) => {
          spec.tags = spec.tags?.map((tag) => ({ ...tag, name: asciiTag(tag.name) }));
          for (const item of Object.values(spec.paths ?? {}))
            for (const operation of Object.values(item ?? {}))
              if (operation && typeof operation === 'object' && 'tags' in operation)
                operation.tags = operation.tags?.map(asciiTag);
          return spec;
        },
      },
    },
    output: {
      client: 'fetch',
      mode: 'tags-split',
      target: './src/generated/endpoints.ts',
      schemas: './src/generated/model',
      indexFiles: true,
      clean: true,
      tsconfig: { compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' } },
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: { path: './src/request.ts', name: 'request', extension: '.js' },
      },
    },
  },
});
