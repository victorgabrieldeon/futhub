import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { configureSwagger } from './app.js';
import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
await configureSwagger(app);
const port = Number(process.env.API_PORT ?? 3000);

await app.listen({ host: '0.0.0.0', port });
