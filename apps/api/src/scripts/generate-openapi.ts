import { writeFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { createOpenApiDocument } from '../openapi.js';
import { workspacePath } from '../workspace-path.js';

// @futhub/database demands DATABASE_URL on import; preview mode never connects.
process.env.DATABASE_URL ??= 'postgresql://openapi@localhost:5432/openapi';
const { AppModule } = await import('../app.module.js');

// Preview mode resolves routes without instantiating providers, so no database is needed.
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
  preview: true,
  logger: false,
});
const document = createOpenApiDocument(app);
await writeFile(workspacePath('apps/api/openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
await app.close();
