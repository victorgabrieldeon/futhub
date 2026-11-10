import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  type E2eContext,
  adminToken,
  internalToken,
  startE2eContext,
} from '../../../test/e2e/context.js';
import {
  createPackFixture,
  createSoccerFieldFixture,
  createTradeFixture,
  createUser,
} from '../../../test/e2e/entities.js';

let context: E2eContext;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

function admin(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) {
  return context.app.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${adminToken}`,
      'x-admin-request': '1',
      ...(payload ? { 'content-type': 'application/json' } : {}),
    },
    payload: payload ? JSON.stringify(payload) : undefined,
  });
}

test('requires admin authentication', async () => {
  const response = await context.app.inject({ method: 'GET', url: '/v1/admin/users' });

  expect(response.statusCode).toBe(401);
});

test('searches users by name or Discord id with pagination', async () => {
  await createUser(context.database, { id: '310000000000000001', name: 'Zico', avatarUrl: null });
  await createUser(context.database, { id: '310000000000000002', name: 'Zinho', avatarUrl: null });
  await createUser(context.database, {
    id: '310000000000000003',
    name: 'Romário',
    avatarUrl: null,
  });

  const byName = await admin('GET', '/v1/admin/users?query=zi&pageSize=1');
  expect(byName.statusCode).toBe(200);
  expect(byName.json()).toMatchObject({ total: 2, page: 1, pageSize: 1 });
  expect(byName.json().items).toHaveLength(1);

  const byDiscordId = await admin('GET', '/v1/admin/users?query=310000000000000003');
  expect(byDiscordId.json().items).toEqual([
    expect.objectContaining({ name: 'Romário', discordUserId: '310000000000000003', cardCount: 0 }),
  ]);

  const wildcard = await admin('GET', '/v1/admin/users?query=%25');
  expect(wildcard.json().total).toBe(0);
});

test('adjusts balance with audit trail and edits progression flags', async () => {
  const { db, eq, schema } = context.database;
  const user = await createUser(
    context.database,
    { id: '320000000000000001', name: 'Saldo', avatarUrl: null },
    100,
  );

  const credited = await admin('POST', `/v1/admin/users/${user.id}/balance`, { amount: 250 });
  expect(credited.statusCode).toBe(201);
  expect(credited.json()).toMatchObject({
    balance: 350,
    transactions: [expect.objectContaining({ type: 'admin', amount: 250 })],
  });
  const overdraft = await admin('POST', `/v1/admin/users/${user.id}/balance`, { amount: -351 });
  expect(overdraft.statusCode).toBe(400);
  const debited = await admin('POST', `/v1/admin/users/${user.id}/balance`, { amount: -50 });
  expect(debited.json().balance).toBe(300);
  const [stored] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  expect(stored?.saldo).toBe(300);
  const history = await db
    .select({ type: schema.transactionHistory.type, amount: schema.transactionHistory.amount })
    .from(schema.transactionHistory)
    .where(eq(schema.transactionHistory.userId, user.id));
  expect(history).toEqual(
    expect.arrayContaining([
      { type: 'admin', amount: 250 },
      { type: 'admin', amount: -50 },
    ]),
  );

  const invalidXp = await admin('PUT', `/v1/admin/users/${user.id}`, {
    level: 2,
    xp: 10_000,
    booster: false,
    banned: false,
  });
  expect(invalidXp.statusCode).toBe(400);
  const updated = await admin('PUT', `/v1/admin/users/${user.id}`, {
    level: 5,
    xp: 40,
    booster: true,
    banned: false,
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json()).toMatchObject({ level: 5, xp: 40, booster: true, banned: false });
  const [progressed] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  expect(progressed).toMatchObject({ level: 5, xp: 40, booster: true });

  const missing = await admin('GET', '/v1/admin/users/00000000-0000-4000-8000-000000000000');
  expect(missing.statusCode).toBe(404);
});

test('grants and removes cards, packs and fields', async () => {
  const { and, db, eq, schema } = context.database;
  const { packId, cardId } = await createPackFixture(context.database);
  const { fieldId } = await createSoccerFieldFixture(context.database, 'Maracanã E2E');
  const user = await createUser(context.database, {
    id: '330000000000000001',
    name: 'Inventário',
    avatarUrl: null,
  });

  const options = await admin('GET', '/v1/admin/users/options');
  expect(options.json()).toMatchObject({
    cards: expect.arrayContaining([{ id: cardId, name: 'Pack card' }]),
    fields: expect.arrayContaining([{ id: fieldId, name: 'Maracanã E2E' }]),
  });

  const withCards = await admin('POST', `/v1/admin/users/${user.id}/cards`, {
    cardId,
    quantity: 2,
  });
  expect(withCards.statusCode).toBe(201);
  expect(withCards.json()).toMatchObject({ cardCount: 2, maxCards: 100 });
  const ownedCards = await db
    .select()
    .from(schema.userCards)
    .where(eq(schema.userCards.userId, user.id));
  expect(ownedCards).toHaveLength(2);
  expect(ownedCards.every((card) => card.claimedBy === 'admin')).toBe(true);
  const overCapacity = await admin('POST', `/v1/admin/users/${user.id}/cards`, {
    cardId,
    quantity: 99,
  });
  expect(overCapacity.statusCode).toBe(409);

  const [kept, removed] = ownedCards;
  if (!kept || !removed) throw new Error('Expected two granted cards.');
  const other = await createUser(context.database, {
    id: '330000000000000002',
    name: 'Parceiro',
    avatarUrl: null,
  });
  await createTradeFixture(context.database, {
    senderId: user.id,
    recipientId: other.id,
    userCardId: kept.id,
  });
  const traded = await admin('DELETE', `/v1/admin/users/${user.id}/cards/${kept.id}`);
  expect(traded.statusCode).toBe(409);
  const notOwned = await admin('DELETE', `/v1/admin/users/${other.id}/cards/${removed.id}`);
  expect(notOwned.statusCode).toBe(404);
  const afterRemoval = await admin('DELETE', `/v1/admin/users/${user.id}/cards/${removed.id}`);
  expect(afterRemoval.statusCode).toBe(200);
  expect(afterRemoval.json().cards).toEqual([
    expect.objectContaining({ id: kept.id, inTrade: true, claimedBy: 'admin' }),
  ]);
  const [deleted] = await db
    .select()
    .from(schema.userCards)
    .where(eq(schema.userCards.id, removed.id));
  expect(deleted).toBeUndefined();

  const withPacks = await admin('PUT', `/v1/admin/users/${user.id}/packs/${packId}`, {
    quantity: 3,
  });
  expect(withPacks.json().packs).toEqual([{ packId, name: 'E2E pack', quantity: 3 }]);
  await admin('PUT', `/v1/admin/users/${user.id}/packs/${packId}`, { quantity: 0 });
  const packs = await db
    .select()
    .from(schema.userPacks)
    .where(and(eq(schema.userPacks.userId, user.id), eq(schema.userPacks.packId, packId)));
  expect(packs).toEqual([]);

  const withField = await admin('PUT', `/v1/admin/users/${user.id}/fields/${fieldId}`);
  expect(withField.json().fields).toEqual([{ fieldId, name: 'Maracanã E2E' }]);
  const revoked = await admin('DELETE', `/v1/admin/users/${user.id}/fields/${fieldId}`);
  expect(revoked.json().fields).toEqual([]);
  const fields = await db
    .select()
    .from(schema.userSoccerFields)
    .where(eq(schema.userSoccerFields.userId, user.id));
  expect(fields).toEqual([]);
});

test('banned users are rejected by gameplay commands', async () => {
  const { db, eq, schema } = context.database;
  const identity = { id: '340000000000000001', name: 'Banido', avatarUrl: null };
  const user = await createUser(context.database, identity, 500);

  const banned = await admin('PUT', `/v1/admin/users/${user.id}`, {
    level: 1,
    xp: 0,
    booster: false,
    banned: true,
  });
  expect(banned.json().banned).toBe(true);

  const rejected = await context.app.inject({
    method: 'POST',
    url: '/v1/commands/resgatar',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: { identity, code: 'QUALQUER' },
  });
  expect(rejected.statusCode).toBe(403);
  const [stored] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  expect(stored).toMatchObject({ banned: true, saldo: 500 });
});
