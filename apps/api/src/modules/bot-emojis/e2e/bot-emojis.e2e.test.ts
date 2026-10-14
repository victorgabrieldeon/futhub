import { randomUUID } from 'node:crypto';

import { createCanvas } from '@napi-rs/canvas';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';

import {
  type E2eContext,
  adminToken,
  internalToken,
  startE2eContext,
} from '../../../test/e2e/context.js';
import { createEntityEmojiFixture, createFileFixture } from '../../../test/e2e/entities.js';
import type { FilesService } from '../../files/files.service.js';
import type { EntityEmojisService } from '../entity-emojis.service.js';

let context: E2eContext;
let filesServiceClass: typeof FilesService;
let entityEmojisServiceClass: typeof EntityEmojisService;
const environment = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
};
beforeAll(async () => {
  context = await startE2eContext();
  // Static loading races the isolated Vite bootstrap for this app module.
  ({ FilesService: filesServiceClass } = await import('../../files/files.service.js'));
  ({ EntityEmojisService: entityEmojisServiceClass } = await import('../entity-emojis.service.js'));
}, 120_000);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

/** Logo retangular: o emoji encaixa a imagem em 128x128 sem distorcer. */
async function logo(): Promise<Buffer> {
  const canvas = createCanvas(256, 128);
  const context2d = canvas.getContext('2d');
  context2d.fillStyle = '#c52613';
  context2d.fillRect(0, 0, 256, 128);
  return canvas.encode('png');
}

function emojiId(mention: string | null | undefined): string {
  const id = /^<:[a-z0-9_]{2,32}:(\d{17,20})>$/.exec(mention ?? '')?.[1];
  if (!id) throw new Error(`Expected a Discord emoji mention, got ${mention}.`);
  return id;
}

async function linkedEmojis(ids: { teamId: string; collectionId: string; packId: string }) {
  const { db, eq, schema } = context.database;
  const select = <T extends typeof schema.teams | typeof schema.collections | typeof schema.packs>(
    table: T,
    id: string,
  ) =>
    db
      .select({ discordEmoji: table.discordEmoji, discordEmojiFileId: table.discordEmojiFileId })
      .from(table as typeof schema.teams)
      .where(eq(table.id, id))
      .then(([row]) => row);
  const [team, collection, pack] = await Promise.all([
    select(schema.teams, ids.teamId),
    select(schema.collections, ids.collectionId),
    select(schema.packs, ids.packId),
  ]);
  return { team, collection, pack };
}

test('backfills Discord emojis for teams, collections and packs with images', async () => {
  const discord = mockDiscord();
  const fixture = await createEntityEmojiFixture(context.database);
  vi.spyOn(filesServiceClass.prototype, 'read').mockResolvedValue(await logo());
  const service = context.app.get(entityEmojisServiceClass);

  await service.backfill();

  const linked = await linkedEmojis(fixture);
  expect(linked.team?.discordEmoji).toMatch(/^<:tm_emoji_team_[a-z0-9_]*_[0-9a-f]{6}:\d+>$/);
  expect(linked.collection?.discordEmoji).toMatch(/^<:col_emoji_collection_[a-z0-9_]+:\d+>$/);
  expect(linked.pack?.discordEmoji).toBe(
    `<:pk_pack_lendario_${fixture.packFile.id.replace(/-/g, '').slice(0, 6)}:${emojiId(linked.pack?.discordEmoji)}>`,
  );
  expect(linked.team?.discordEmojiFileId).toBe(fixture.teamFile.id);
  expect(linked.collection?.discordEmojiFileId).toBe(fixture.collectionFile.id);
  expect(linked.pack?.discordEmojiFileId).toBe(fixture.packFile.id);
  for (const row of Object.values(linked))
    expect(discord.emojis.has(emojiId(row?.discordEmoji))).toBe(true);
  const [plainTeam] = await context.database.db
    .select({ discordEmoji: context.database.schema.teams.discordEmoji })
    .from(context.database.schema.teams)
    .where(context.database.eq(context.database.schema.teams.id, fixture.plainTeamId));
  expect(plainTeam?.discordEmoji).toBeNull();

  // O bot recebe o emoji do Discord no lugar do unicode.
  const catalog = await request('GET', '/v1/packs', undefined, internalToken);
  expect(catalog.statusCode, catalog.body).toBe(200);
  expect(catalog.json().find((pack: { id: string }) => pack.id === fixture.packId)?.emoji).toBe(
    linked.pack?.discordEmoji,
  );

  const created = discord.calls.filter((call) => call.method === 'POST').length;
  await service.backfill();
  expect(discord.calls.filter((call) => call.method === 'POST').length).toBe(created);

  // Emoji apagado direto no Discord volta na próxima subida.
  discord.emojis.delete(emojiId(linked.team?.discordEmoji));
  await service.backfill();
  const healed = await linkedEmojis(fixture);
  expect(emojiId(healed.team?.discordEmoji)).not.toBe(emojiId(linked.team?.discordEmoji));
  expect(discord.emojis.has(emojiId(healed.team?.discordEmoji))).toBe(true);
  expect(healed.collection).toEqual(linked.collection);
});

test('replaces the Discord emoji when an admin edits a team image and deletes it with the team', async () => {
  const discord = mockDiscord();
  const fixture = await createEntityEmojiFixture(context.database);
  const files = await Promise.all(
    [1, 2].map((index) =>
      createFileFixture(context.database, `emoji/edit-${index}-${randomUUID()}.png`),
    ),
  );
  const imported = [...files];
  vi.spyOn(filesServiceClass.prototype, 'read').mockResolvedValue(await logo());
  vi.spyOn(filesServiceClass.prototype, 'removeIfUnused').mockResolvedValue();
  vi.spyOn(filesServiceClass.prototype, 'importImage').mockImplementation(async () => {
    const file = imported.shift();
    if (!file) throw new Error('Unexpected image import.');
    return { ...file, url: `https://minio.test/${file.objectKey}` };
  });
  const team = {
    name: `Edited team ${randomUUID()}`,
    slug: `edited-team-${randomUUID()}`,
    emoji: '⚽',
    color: '#000000',
  };
  const update = (imageUrl: string | null) =>
    request('PUT', `/v1/admin/cards/teams/${fixture.teamId}`, { ...team, imageUrl });
  const linkedTeam = async () => (await linkedEmojis(fixture)).team;

  const first = await update('https://assets.footylogos.com/logos/a/a-logo-footylogos.svg');
  expect(first.statusCode, first.body).toBe(200);
  const firstLink = await linkedTeam();
  expect(firstLink?.discordEmojiFileId).toBe(files[0]?.id);
  expect(discord.emojis.get(emojiId(firstLink?.discordEmoji))?.name).toMatch(/^tm_edited_team_/);

  const second = await update('https://assets.footylogos.com/logos/b/b-logo-footylogos.svg');
  expect(second.statusCode, second.body).toBe(200);
  const secondLink = await linkedTeam();
  expect(secondLink?.discordEmojiFileId).toBe(files[1]?.id);
  expect(discord.emojis.has(emojiId(secondLink?.discordEmoji))).toBe(true);
  expect(discord.emojis.has(emojiId(firstLink?.discordEmoji))).toBe(false);

  const removed = await update(null);
  expect(removed.statusCode, removed.body).toBe(200);
  expect(await linkedTeam()).toEqual({ discordEmoji: null, discordEmojiFileId: null });
  expect(discord.emojis.has(emojiId(secondLink?.discordEmoji))).toBe(false);

  const collectionEmoji = (await linkedEmojis(fixture)).collection?.discordEmoji;
  expect(collectionEmoji).toBeNull();
  await context.app.get(entityEmojisServiceClass).backfill();
  const collectionLink = (await linkedEmojis(fixture)).collection;
  const deleted = await request('DELETE', `/v1/admin/cards/collections/${fixture.collectionId}`);
  expect(deleted.statusCode, deleted.body).toBe(204);
  expect(discord.emojis.has(emojiId(collectionLink?.discordEmoji))).toBe(false);
});
