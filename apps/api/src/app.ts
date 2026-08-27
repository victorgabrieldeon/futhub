import { readFile } from 'node:fs/promises';

import multipart from '@fastify/multipart';
import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';

export async function readOpenApiDocument(): Promise<OpenAPIObject> {
  return JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
}

export async function configureSwagger(app: NestFastifyApplication): Promise<void> {
  SwaggerModule.setup('docs', app, await readOpenApiDocument());
}

export async function buildApp(options?: NestApplicationOptions): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    options,
  );
  await app.register(multipart as never, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
  await configureSwagger(app);
  await app.init();
  return app;
}
