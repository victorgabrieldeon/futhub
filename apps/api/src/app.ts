import { readFile } from 'node:fs/promises';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export async function readOpenApiDocument(): Promise<OpenAPIObject> {
  return JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
}

export async function configureSwagger(app: NestFastifyApplication): Promise<void> {
  SwaggerModule.setup('docs', app, await readOpenApiDocument());
}
