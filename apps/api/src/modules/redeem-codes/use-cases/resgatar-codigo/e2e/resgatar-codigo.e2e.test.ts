import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  type E2eContext,
  internalToken,
  startE2eContext,
} from '../../../../../test/e2e/context.js';
import {
  createPackFixture,
  createRedeemCodeFixture,
  createUser,
} from '../../../../../test/e2e/entities.js';

let context: E2eContext;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

function identity(id: string) {
  return { id, name: `Jogador ${id.slice(-2)}`, avatarUrl: null };
}

function redeem(discordId: string, code: string) {
  return context.app.inject({
    method: 'POST',
    url: '/v1/commands/resgatar',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: { identity: identity(discordId), code },
  });
}

async function userState(discordId: string) {
  const { db, eq, schema } = context.database;
  const user = await db.query.users.findFirst({ where: eq(schema.users.discordUserId, discordId) });
  if (!user) throw new Error('User was not persisted.');
  return user;
}

test('protects resgatar with internal authentication', async () => {
  const response = await context.app.inject({
    method: 'POST',
    url: '/v1/commands/resgatar',
    payload: { identity: identity('100000000000000001'), code: 'QUALQUER' },
  });

  expect(response.statusCode).toBe(401);
});

test('credits balance once per player and records the Resgate', async () => {
  const { db, eq, schema } = context.database;
  await createUser(context.database, identity('100000000000000002'), 100);
  const { redeemId } = await createRedeemCodeFixture(context.database, {
    code: 'BEMVINDO',
    reward: { type: 'balance', amount: 500 },
  });

  const first = await redeem('100000000000000002', ' bemvindo ');

  expect(first.statusCode).toBe(200);
  expect(first.json()).toEqual({
    kind: 'success',
    code: 'BEMVINDO',
    reward: {
      itemId: expect.any(String),
      type: 'balance',
      quantity: 500,
      resourceId: null,
      resourceName: null,
    },
    balance: 600,
  });
  const user = await userState('100000000000000002');
  expect(user.saldo).toBe(600);
  const claims = await db
    .select()
    .from(schema.redeemClaims)
    .where(eq(schema.redeemClaims.redeemId, redeemId));
  expect(claims).toEqual([expect.objectContaining({ redeemId, userId: user.id })]);
  const history = await db
    .select()
    .from(schema.transactionHistory)
    .where(eq(schema.transactionHistory.userId, user.id));
  expect(history).toEqual([expect.objectContaining({ type: 'redeem', amount: 500 })]);

  const second = await redeem('100000000000000002', 'BEMVINDO');

  expect(second.json()).toEqual({ kind: 'rejected', reason: 'already_redeemed' });
  expect((await userState('100000000000000002')).saldo).toBe(600);
});

test('grants card and pack Items with redeem origin', async () => {
  const { db, eq, schema } = context.database;
  const { cardId, packId } = await createPackFixture(context.database);
  await createRedeemCodeFixture(context.database, {
    code: 'CARD-E2E',
    reward: { type: 'card', amount: 2, cardId },
  });
  await createRedeemCodeFixture(context.database, {
    code: 'PACK_E2E',
    reward: { type: 'pack', amount: 3, packId },
  });

  const card = await redeem('100000000000000003', 'card-e2e');
  const pack = await redeem('100000000000000003', 'pack_e2e');

  expect(card.json()).toMatchObject({
    kind: 'success',
    reward: { type: 'card', quantity: 2, resourceId: cardId, resourceName: 'Pack card' },
  });
  expect(pack.json()).toMatchObject({
    kind: 'success',
    reward: { type: 'pack', quantity: 3, resourceId: packId, resourceName: 'E2E pack' },
  });
  const user = await userState('100000000000000003');
  const cards = await db
    .select()
    .from(schema.userCards)
    .where(eq(schema.userCards.userId, user.id));
  expect(cards).toHaveLength(2);
  expect(cards.every((row) => row.cardId === cardId && row.claimedBy === 'redeem')).toBe(true);
  const packs = await db
    .select()
    .from(schema.userPacks)
    .where(eq(schema.userPacks.userId, user.id));
  expect(packs).toEqual([expect.objectContaining({ packId, quantity: 3 })]);
});

test('rejects codes whose conditions are not met without granting', async () => {
  const { db, eq, schema } = context.database;
  const { cardId } = await createPackFixture(context.database);
  await createRedeemCodeFixture(context.database, {
    code: 'DESATIVADO',
    reward: { type: 'balance', amount: 10 },
    active: false,
  });
  await createRedeemCodeFixture(context.database, {
    code: 'EXPIRADO',
    reward: { type: 'balance', amount: 10 },
    expiresAt: new Date(Date.now() - 60_000),
  });
  const { redeemId: limitedId } = await createRedeemCodeFixture(context.database, {
    code: 'UNICO',
    reward: { type: 'balance', amount: 10 },
    maxClaims: 1,
  });
  await createRedeemCodeFixture(context.database, {
    code: 'MUITASCARTAS',
    reward: { type: 'card', amount: 101, cardId },
  });

  expect((await redeem('100000000000000004', 'NAOEXISTE')).json()).toEqual({
    kind: 'rejected',
    reason: 'not_found',
  });
  expect((await redeem('100000000000000004', 'desativado')).json()).toEqual({
    kind: 'rejected',
    reason: 'inactive',
  });
  expect((await redeem('100000000000000004', 'EXPIRADO')).json()).toEqual({
    kind: 'rejected',
    reason: 'expired',
  });
  expect((await redeem('100000000000000004', 'UNICO')).json()).toMatchObject({
    kind: 'success',
  });
  expect((await redeem('100000000000000005', 'UNICO')).json()).toEqual({
    kind: 'rejected',
    reason: 'exhausted',
  });
  expect((await redeem('100000000000000005', 'MUITASCARTAS')).json()).toEqual({
    kind: 'rejected',
    reason: 'inventory_full',
  });

  const limitedClaims = await db
    .select()
    .from(schema.redeemClaims)
    .where(eq(schema.redeemClaims.redeemId, limitedId));
  expect(limitedClaims).toHaveLength(1);
  const rejected = await userState('100000000000000005');
  expect(rejected.saldo).toBe(0);
  const rejectedCards = await db
    .select()
    .from(schema.userCards)
    .where(eq(schema.userCards.userId, rejected.id));
  expect(rejectedCards).toEqual([]);
});

test('lets only one concurrent Resgate consume the last claim', async () => {
  const { db, eq, schema } = context.database;
  const { redeemId } = await createRedeemCodeFixture(context.database, {
    code: 'CORRIDA',
    reward: { type: 'balance', amount: 50 },
    maxClaims: 1,
  });

  const responses = await Promise.all(
    ['100000000000000006', '100000000000000007', '100000000000000008'].map((id) =>
      redeem(id, 'CORRIDA'),
    ),
  );

  const kinds = responses.map((response) => response.json().kind).sort();
  expect(kinds).toEqual(['rejected', 'rejected', 'success']);
  const claims = await db
    .select()
    .from(schema.redeemClaims)
    .where(eq(schema.redeemClaims.redeemId, redeemId));
  expect(claims).toHaveLength(1);
});
