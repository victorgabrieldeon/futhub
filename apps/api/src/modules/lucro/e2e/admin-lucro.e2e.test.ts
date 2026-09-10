import { afterAll, beforeAll, expect, test } from 'vitest';

import { adminToken, type E2eContext, startE2eContext } from '../../../test/e2e/context.js';

let context: E2eContext;

beforeAll(async () => {
  context = await startE2eContext();
}, 30_000);

afterAll(async () => {
  await context?.close();
});

test('authorizes session cookie and persists lucro configuration', async () => {
  const login = await context.app.inject({
    method: 'POST',
    url: '/v1/admin/session',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ apiKey: adminToken }),
  });
  expect(login.statusCode).toBe(201);
  const setCookie = login.headers['set-cookie'];
  const sessionCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!sessionCookie) throw new Error('Admin session cookie is missing.');
  expect(sessionCookie).toContain('admin_api_key=admin-test-token');
  expect(sessionCookie).toContain('HttpOnly');

  const schema = await request('GET', '/v1/admin/lucro/schema', undefined, sessionCookie);
  expect(schema.statusCode).toBe(200);
  expect(schema.json()).toMatchObject({ properties: { color: { examples: ['#2B2D31'] } } });

  const input = {
    cooldownSeconds: 900,
    rewards: [
      {
        value: 80,
        weight: 3,
        messages: { pt: 'Lucro pt', es: 'Lucro es', en: 'Profit en' },
      },
    ],
    embed: {
      title: 'Lucro',
      description: '{message} {balance}',
      color: '#123456',
      footer: 'Próximo: {availableAt}',
    },
  };
  const response = await request('PUT', '/v1/admin/lucro', input, sessionCookie);
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject(input);

  const [config] = await context.database.db
    .select()
    .from(context.database.schema.commandConfigs)
    .where(context.database.eq(context.database.schema.commandConfigs.commandName, 'lucro'));
  if (!config) throw new Error('Lucro configuration is missing.');
  expect(config).toMatchObject({ cooldownSeconds: 900, embed: input.embed });
  const [reward] = await context.database.db
    .select()
    .from(context.database.schema.commandRewards)
    .where(context.database.eq(context.database.schema.commandRewards.commandConfigId, config.id));
  const [inputReward] = input.rewards;
  if (!inputReward) throw new Error('Lucro input reward is missing.');
  expect(reward).toMatchObject({
    value: 80,
    weight: 3,
    message: 'Lucro pt',
    messages: inputReward.messages,
  });
  const logout = await context.app.inject({ method: 'DELETE', url: '/v1/admin/session' });
  expect(logout.statusCode).toBe(204);
  const expiredCookie = logout.headers['set-cookie'];
  const expiredSessionCookie = Array.isArray(expiredCookie) ? expiredCookie[0] : expiredCookie;
  if (!expiredSessionCookie) throw new Error('Expired admin session cookie is missing.');
  expect(expiredSessionCookie).toContain('Max-Age=0');

  const expired = await request('GET', '/v1/admin/lucro/schema', undefined, expiredSessionCookie);
  expect(expired.statusCode).toBe(401);
});

function request(method: 'GET' | 'PUT', url: string, payload?: unknown, sessionCookie?: string) {
  return context.app.inject({
    method,
    url,
    headers: {
      ...(sessionCookie ? { cookie: sessionCookie } : { authorization: `Bearer ${adminToken}` }),
      'content-type': 'application/json',
    },
    payload: payload ? JSON.stringify(payload) : undefined,
  });
}
