import type { INestiaConfig } from '@nestia/sdk';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './src/app.module.js';

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
  input: async () => {
    process.env.API_INTERNAL_TOKEN ||= 'openapi-generation';
    process.env.DATABASE_URL ||= 'postgresql://openapi-generation';
    return NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
  },
  swagger: { ...swaggerConfig, output: 'openapi.json' },
} satisfies INestiaConfig;
