import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  internalToken,
  type E2eContext,
  startE2eContext,
} from '../../../../../test/e2e/context.js';

let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('exposes public health check', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app } = context;

  const response = await app.inject({ method: 'GET', url: '/health' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
});

test('protects lucro with internal authentication', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app } = context;

  const response = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    payload: { id: '123456789012345678', name: 'Nome', avatarUrl: null },
  });

  expect(response.statusCode).toBe(401);
});

test('validates lucro identity', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app } = context;

  const response = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: { id: '', name: 'Nome', avatarUrl: null },
  });

  expect(response.statusCode).toBe(400);
});

test('resgata lucro once and enters cooldown', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app: application } = context;
  const request = () =>
    application.inject({
      method: 'POST',
      url: '/v1/commands/lucro',
      headers: { authorization: `Bearer ${internalToken}` },
      payload: { id: '123456789012345678', name: 'Nome', avatarUrl: null },
    });

  const success = await request();
  const successBody = success.json();
  expect(success.statusCode).toBe(200);
  expect(successBody).toMatchObject({
    kind: 'success',
    progression: { gainedXp: 10, level: 1, xp: 10, nextLevelXp: 100, rewards: [] },
  });

  const cooldown = await request();
  expect(cooldown.statusCode).toBe(200);
  expect(cooldown.json()).toEqual({
    kind: 'cooldown',
    availableAt: successBody.availableAt,
  });
});
