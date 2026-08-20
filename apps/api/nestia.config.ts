import type { INestiaConfig } from '@nestia/sdk';

export const swaggerConfig = {
  openapi: '3.0',
  info: { title: 'Dreamfut API', version: '1.0' },
  servers: [],
  security: {
    bearer: { type: 'http', scheme: 'bearer' },
  },
  beautify: true,
} satisfies Omit<INestiaConfig.ISwaggerConfig, 'output'>;

export default {
  input: 'src/**/*.controller.ts',
  swagger: { ...swaggerConfig, output: 'openapi.json' },
} satisfies INestiaConfig;
