import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';

import {
  type E2eContext,
  adminToken,
  internalToken,
  startE2eContext,
} from '../../../test/e2e/context.js';

let context: E2eContext;
const environment = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
};
beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);
afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
afterAll(async () => {
  await context?.close();
});

const png = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]).toString('base64')}`;

/** In-memory Discord application emoji store; it is the persisted state these routes manage. */
function mockDiscord() {
  process.env.DISCORD_TOKEN = 'bot-token';
  process.env.DISCORD_CLIENT_ID = '100000000000000000';
  const emojis = new Map<string, { id: string; name: string; animated: boolean }>([
    ['200000000000000001', { id: '200000000000000001', name: 'trofeu', animated: true }],
  ]);
  let next = 300000000000000000n;
  const calls: { method: string; path: string; authorization: string | null }[] = [];
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    calls.push({
      method,
      path: url.pathname,
      authorization: new Headers(init.headers).get('authorization'),
    });
    const base = '/api/v10/applications/100000000000000000/emojis';
    const id = url.pathname.slice(base.length + 1);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    if (!url.pathname.startsWith(base))
      return Response.json({ message: 'Unknown' }, { status: 404 });
    if (method === 'GET') return Response.json({ items: [...emojis.values()] });
    if (method === 'POST') {
      const emoji = { id: String(next++), name: body.name, animated: false };
      emojis.set(emoji.id, emoji);
      return Response.json(emoji, { status: 201 });
    }
    const emoji = emojis.get(id);
    if (!emoji) return Response.json({ message: 'Unknown Emoji', code: 10014 }, { status: 404 });
    if (method === 'PATCH') {
      emoji.name = body.name;
      return Response.json(emoji);
    }
    emojis.delete(id);
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { emojis, calls };
}

function request(method: string, url: string, payload?: unknown, token = adminToken) {
  return context.app.inject({
    method: method as 'GET',
    url,
    headers: {
      authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    payload: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

test('guards routes and explains missing Discord configuration', async () => {
  for (const [method, url] of [
    ['GET', '/v1/admin/bot-emojis'],
    ['POST', '/v1/admin/bot-emojis'],
    ['PATCH', '/v1/admin/bot-emojis/200000000000000001'],
    ['DELETE', '/v1/admin/bot-emojis/200000000000000001'],
    ['GET', '/v1/bot-emojis'],
  ] as const)
    expect((await context.app.inject({ method, url })).statusCode).toBe(401);
  expect((await request('GET', '/v1/admin/bot-emojis', undefined, internalToken)).statusCode).toBe(
    401,
  );
  expect((await request('GET', '/v1/bot-emojis')).statusCode).toBe(401);
  process.env.DISCORD_TOKEN = '';
  const missing = await request('GET', '/v1/admin/bot-emojis');
  expect(missing.statusCode).toBe(503);
  expect(missing.json().message).toMatch(/DISCORD_TOKEN/);
});

test('creates, renames and deletes Discord application emojis', async () => {
  const discord = mockDiscord();
  const listed = await request('GET', '/v1/admin/bot-emojis');
  expect(listed.statusCode).toBe(200);
  expect(listed.json()).toEqual({
    limit: 2000,
    emojis: [
      {
        id: '200000000000000001',
        name: 'trofeu',
        animated: true,
        imageUrl: 'https://cdn.discordapp.com/emojis/200000000000000001.gif',
      },
    ],
  });
  expect(discord.calls[0]?.authorization).toBe('Bot bot-token');

  const created = await request('POST', '/v1/admin/bot-emojis', { name: 'moeda', image: png });
  expect(created.statusCode).toBe(201);
  const id = created.json().id as string;
  expect(created.json()).toEqual({
    id,
    name: 'moeda',
    animated: false,
    imageUrl: `https://cdn.discordapp.com/emojis/${id}.png`,
  });
  expect(discord.emojis.get(id)?.name).toBe('moeda');

  const renamed = await request('PATCH', `/v1/admin/bot-emojis/${id}`, { name: 'coin' });
  expect(renamed.statusCode).toBe(200);
  expect(discord.emojis.get(id)?.name).toBe('coin');

  const internal = await request('GET', '/v1/bot-emojis', undefined, internalToken);
  expect(internal.statusCode).toBe(200);
  expect(internal.json().emojis.map((emoji: { name: string }) => emoji.name)).toEqual([
    'coin',
    'trofeu',
  ]);
  const reads = discord.calls.filter((call) => call.method === 'GET').length;
  await request('GET', '/v1/bot-emojis', undefined, internalToken);
  expect(discord.calls.filter((call) => call.method === 'GET').length).toBe(reads);

  expect((await request('DELETE', `/v1/admin/bot-emojis/${id}`)).statusCode).toBe(204);
  expect(discord.emojis.has(id)).toBe(false);
  expect(
    (await request('GET', '/v1/bot-emojis', undefined, internalToken))
      .json()
      .emojis.map((emoji: { name: string }) => emoji.name),
  ).toEqual(['trofeu']);
  expect((await request('DELETE', `/v1/admin/bot-emojis/${id}`)).statusCode).toBe(404);
});

test('rejects invalid names, images and duplicates without touching Discord state', async () => {
  const discord = mockDiscord();
  const gif = `data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}`;
  for (const payload of [
    { name: 'a', image: png },
    { name: 'nome-invalido', image: png },
    { name: 'moeda', image: 'https://example.com/moeda.png' },
    { name: 'moeda', image: `data:image/png;base64,${Buffer.from('GIF89a').toString('base64')}` },
    {
      name: 'moeda',
      image: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`,
    },
    {
      name: 'moeda',
      image: `data:image/png;base64,${Buffer.concat([Buffer.from(png.slice(22), 'base64'), Buffer.alloc(256 * 1024)]).toString('base64')}`,
    },
  ])
    expect((await request('POST', '/v1/admin/bot-emojis', payload)).statusCode).toBe(400);
  const duplicate = await request('POST', '/v1/admin/bot-emojis', { name: 'TROFEU', image: gif });
  expect(duplicate.statusCode).toBe(409);
  expect(
    (await request('PATCH', '/v1/admin/bot-emojis/not-a-snowflake', { name: 'coin' })).statusCode,
  ).toBe(404);
  expect(discord.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  expect([...discord.emojis.values()].map((emoji) => emoji.name)).toEqual(['trofeu']);
});
