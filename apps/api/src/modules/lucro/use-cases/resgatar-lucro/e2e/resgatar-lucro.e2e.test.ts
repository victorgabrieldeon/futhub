import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, expect, test } from 'vitest';

import { buildApp } from '../../../../../app.js';

const execFileAsync = promisify(execFile);
let container: StartedTestContainer | undefined;
let database: typeof import('@dreamfut/database') | undefined;
let app: NestFastifyApplication | undefined;

beforeAll(async () => {
  container = await new GenericContainer('postgres:17-alpine')
    .withEnvironment({
      POSTGRES_DB: 'dreamfut_e2e',
      POSTGRES_USER: 'dreamfut',
      POSTGRES_PASSWORD: 'dreamfut',
    })
    .withExposedPorts(5432)
    .withHealthCheck({
      test: ['CMD-SHELL', 'pg_isready -U dreamfut -d dreamfut_e2e'],
      interval: 1_000,
      timeout: 5_000,
      retries: 10,
    })
    .withWaitStrategy(Wait.forHealthCheck())
    .start();
  process.env.DATABASE_URL = `postgresql://dreamfut:dreamfut@${container.getHost()}:${container.getMappedPort(5432)}/dreamfut_e2e`;
  process.env.API_INTERNAL_TOKEN = 'test-token';
  await execFileAsync('pnpm', ['--filter', '@dreamfut/database', 'db:migrate'], {
    cwd: process.cwd(),
    env: process.env,
  });
  database = await import('@dreamfut/database');
  app = await buildApp({ logger: false });
}, 120_000);

afterAll(async () => {
  await app?.close();
  await database?.pool.end();
  await container?.stop();
});

test('exposes public health check', async () => {
  if (!app) throw new Error('Application was not initialized.');

  const response = await app.inject({ method: 'GET', url: '/health' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
});

test('protects lucro with internal authentication', async () => {
  if (!app) throw new Error('Application was not initialized.');

  const response = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    payload: { id: '123456789012345678', name: 'Nome', avatarUrl: null },
  });

  expect(response.statusCode).toBe(401);
});

test('validates lucro identity', async () => {
  if (!app) throw new Error('Application was not initialized.');

  const response = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers: { authorization: 'Bearer test-token' },
    payload: { id: '', name: 'Nome', avatarUrl: null },
  });

  expect(response.statusCode).toBe(400);
});

test('resgata lucro once and enters cooldown', async () => {
  if (!app) throw new Error('Application was not initialized.');
  const application = app;
  const request = () =>
    application.inject({
      method: 'POST',
      url: '/v1/commands/lucro',
      headers: { authorization: 'Bearer test-token' },
      payload: { id: '123456789012345678', name: 'Nome', avatarUrl: null },
    });

  const success = await request();
  const successBody = success.json();
  expect(success.statusCode).toBe(200);
  expect(successBody).toMatchObject({
    kind: 'success',
  });

  const cooldown = await request();
  expect(cooldown.statusCode).toBe(200);
  expect(cooldown.json()).toEqual({
    kind: 'cooldown',
    availableAt: successBody.availableAt,
  });
});
