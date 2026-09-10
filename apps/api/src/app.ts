import { readFile } from 'node:fs/promises';

import multipart from '@fastify/multipart';
import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OpenAPIObject } from '@nestjs/swagger';
import { renderApiReference } from '@scalar/client-side-rendering';

import { AppModule } from './app.module.js';

export async function readOpenApiDocument(): Promise<OpenAPIObject> {
  return JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
}

export async function configureApiReference(app: NestFastifyApplication): Promise<void> {
  const content = renderApiReference({
    config: { url: '/openapi.json' },
    pageTitle: 'FutHub API',
  });
  app
    .getHttpAdapter()
    .get('/docs', (_request, response) =>
      response.header('cache-control', 'no-store').type('text/html').send(content),
    );
  app
    .getHttpAdapter()
    .get('/openapi.json', async (_request, response) =>
      response.header('cache-control', 'no-store').send(await readOpenApiDocument()),
    );
}

export async function buildApp(options?: NestApplicationOptions): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    options,
  );
  await app.register(multipart as never, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
  await configureApiReference(app);
  await app.init();
  return app;
}
