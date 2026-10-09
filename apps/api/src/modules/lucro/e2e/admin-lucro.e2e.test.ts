import { createHash } from 'node:crypto';
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
    headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
    payload: JSON.stringify({ apiKey: adminToken }),
  });
  expect(login.statusCode).toBe(201);
  const setCookie = login.headers['set-cookie'];
  const sessionCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!sessionCookie) throw new Error('Admin session cookie is missing.');
  expect(sessionCookie).toContain('futhub_admin_session=');
  expect(sessionCookie).not.toContain(adminToken);
  expect(sessionCookie).toContain('HttpOnly');
  expect(sessionCookie).toContain('SameSite=Strict');

  const token = sessionCookie.split(';')[0]?.split('=')[1];
  if (!token) throw new Error('Admin session token is missing.');
  const [stored] = await context.database.db
    .select()
    .from(context.database.schema.adminSessions)
    .where(
      context.database.eq(
        context.database.schema.adminSessions.tokenHash,
        createHash('sha256').update(token).digest('hex'),
      ),
    );
  expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now());

  const legacy = await context.app.inject({
    method: 'GET',
    url: '/v1/admin/session',
    headers: { cookie: `admin_api_key=${adminToken}` },
  });
  expect(legacy.statusCode).toBe(401);

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

  const crossSiteWrite = await context.app.inject({
    method: 'PUT',
    url: '/v1/admin/lucro',
    headers: { cookie: sessionCookie, 'content-type': 'application/json' },
    payload: JSON.stringify({ ...input, cooldownSeconds: 1200 }),
  });
  expect(crossSiteWrite.statusCode).toBe(403);
  const unchanged = await request('GET', '/v1/admin/lucro', undefined, sessionCookie);
  expect(unchanged.json()).toMatchObject({ cooldownSeconds: 900 });

  const logout = await context.app.inject({
    method: 'DELETE',
    url: '/v1/admin/session',
    headers: { cookie: sessionCookie, 'x-admin-request': '1' },
  });
  expect(logout.statusCode).toBe(204);
  const expiredCookie = logout.headers['set-cookie'];
  const expiredSessionCookie = Array.isArray(expiredCookie) ? expiredCookie[0] : expiredCookie;
  if (!expiredSessionCookie) throw new Error('Expired admin session cookie is missing.');
  expect(expiredSessionCookie).toContain('Max-Age=0');

  const expired = await request('GET', '/v1/admin/lucro/schema', undefined, expiredSessionCookie);
  expect(expired.statusCode).toBe(401);
  const replay = await request('GET', '/v1/admin/lucro/schema', undefined, sessionCookie);
  expect(replay.statusCode).toBe(401);
  const [revoked] = await context.database.db
    .select()
    .from(context.database.schema.adminSessions)
    .where(
      context.database.eq(
        context.database.schema.adminSessions.tokenHash,
        createHash('sha256').update(token).digest('hex'),
      ),
    );
  expect(revoked).toBeUndefined();

  const missingHeader = await context.app.inject({
    method: 'POST',
    url: '/v1/admin/session',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ apiKey: adminToken }),
  });
  expect(missingHeader.statusCode).toBe(403);

  for (let attempt = 0; attempt < 10; attempt++) {
    const invalid = await context.app.inject({
      method: 'POST',
      url: '/v1/admin/session',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      payload: JSON.stringify({ apiKey: 'invalid-token' }),
    });
    expect(invalid.statusCode).toBe(401);
  }
  const [attempts] = await context.database.db
    .select()
    .from(context.database.schema.adminLoginAttempts);
  expect(attempts?.failures).toBe(10);
  const limited = await context.app.inject({
    method: 'POST',
    url: '/v1/admin/session',
    headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
    payload: JSON.stringify({ apiKey: adminToken }),
  });
  expect(limited.statusCode).toBe(429);
});

function request(method: 'GET' | 'PUT', url: string, payload?: unknown, sessionCookie?: string) {
  return context.app.inject({
    method,
    url,
    headers: {
      ...(sessionCookie ? { cookie: sessionCookie } : { authorization: `Bearer ${adminToken}` }),
      ...(method === 'PUT' ? { 'x-admin-request': '1' } : {}),
      'content-type': 'application/json',
    },
    payload: payload ? JSON.stringify(payload) : undefined,
  });
}
