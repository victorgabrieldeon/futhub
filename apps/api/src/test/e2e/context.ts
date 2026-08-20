import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type * as DatabaseModule from '@dreamfut/database';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

import { buildApp } from '../../app.js';

const execFileAsync = promisify(execFile);
export const internalToken = 'test-token';

export type E2eContext = Readonly<{
  app: NestFastifyApplication;
  database: typeof DatabaseModule;
  close(): Promise<void>;
}>;

function restoreEnvironment(
  name: 'DATABASE_URL' | 'API_INTERNAL_TOKEN',
  value: string | undefined,
): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

export async function startE2eContext(): Promise<E2eContext> {
  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.API_INTERNAL_TOKEN;
  let container: StartedTestContainer | undefined;
  let database: typeof DatabaseModule | undefined;
  let app: NestFastifyApplication | undefined;

  try {
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
    process.env.API_INTERNAL_TOKEN = internalToken;
    await execFileAsync('pnpm', ['--filter', '@dreamfut/database', 'db:migrate'], {
      cwd: process.cwd(),
      env: process.env,
    });
    // Database module reads DATABASE_URL during evaluation.
    database = await import('@dreamfut/database');
    app = await buildApp({ logger: false });
    if (!app || !database || !container) throw new Error('Failed to initialize E2E context.');
    const initializedApp = app;
    const initializedDatabase = database;
    const initializedContainer = container;

    return {
      app: initializedApp,
      database: initializedDatabase,
      close: async () => {
        await initializedApp.close();
        await initializedDatabase.pool.end();
        await initializedContainer.stop();
        restoreEnvironment('DATABASE_URL', databaseUrl);
        restoreEnvironment('API_INTERNAL_TOKEN', apiToken);
      },
    };
  } catch (error) {
    await app?.close();
    await database?.pool.end();
    await container?.stop();
    restoreEnvironment('DATABASE_URL', databaseUrl);
    restoreEnvironment('API_INTERNAL_TOKEN', apiToken);
    throw error;
  }
}
