import { afterAll, beforeAll, expect, test } from 'vitest';

import { type E2eContext, internalToken, startE2eContext } from '../../../test/e2e/context.js';
import { createPackFixture, createUser } from '../../../test/e2e/entities.js';

const identity = { id: 'e2e-pack-user', name: 'Pack player', avatarUrl: null };
let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('compra e abre pack persistindo carta e progressão', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const { packId, cardId } = await createPackFixture(database);
  await createUser(database, identity, 100);
  const headers = { authorization: `Bearer ${internalToken}` };

  const purchase = await app.inject({
    method: 'POST',
    url: `/v1/packs/${packId}/purchase`,
    headers,
    payload: { identity },
  });
  expect(purchase.statusCode).toBe(200);
  expect(purchase.json()).toEqual({ balance: 80, quantity: 1 });

  const open = await app.inject({
    method: 'POST',
    url: `/v1/packs/${packId}/open`,
    headers,
    payload: { identity },
  });
  expect(open.statusCode).toBe(200);
  expect(open.json()).toMatchObject({
    cards: [{ card: { id: cardId, overall: 80 } }],
    progression: { gainedXp: 10, level: 1, xp: 10, nextLevelXp: 100, rewards: [] },
  });

  const user = await database.db.query.users.findFirst({
    where: database.eq(database.schema.users.discordUserId, identity.id),
  });
  if (!user) throw new Error('E2E user was not persisted.');
  const inventory = await database.db.query.userPacks.findFirst({
    where: (row, { and, eq }) => and(eq(row.userId, user.id), eq(row.packId, packId)),
  });
  expect(inventory?.quantity).toBe(0);
  const cards = await database.db.query.userCards.findMany({
    where: database.eq(database.schema.userCards.userId, user.id),
  });
  expect(cards).toHaveLength(1);
  expect(cards[0]?.cardId).toBe(cardId);
});

test('lista na loja apenas packs disponíveis para compra', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const { packId } = await createPackFixture(database);
  const { packId: hiddenPackId } = await createPackFixture(database);
  await database.db
    .update(database.schema.packs)
    .set({ canBuy: false })
    .where(database.eq(database.schema.packs.id, hiddenPackId));

  const response = await app.inject({
    method: 'GET',
    url: '/v1/packs',
    headers: { authorization: `Bearer ${internalToken}` },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toContainEqual(
    expect.objectContaining({
      id: packId,
      name: 'E2E pack',
      emoji: '📦',
      cardsAmount: 1,
      price: 20,
      limitPerUser: 10,
    }),
  );
  expect(response.json()).not.toContainEqual(expect.objectContaining({ id: hiddenPackId }));
});
