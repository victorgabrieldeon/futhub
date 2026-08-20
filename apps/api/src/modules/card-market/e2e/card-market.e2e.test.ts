import { afterAll, beforeAll, expect, test } from 'vitest';

import { type E2eContext, internalToken, startE2eContext } from '../../../test/e2e/context.js';
import { createCardMarketFixture, createUser } from '../../../test/e2e/entities.js';

const identity = { id: 'e2e-card-market-user', name: 'Market player', avatarUrl: null };
let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('compra e vende card, persistindo inventário, saldo e histórico', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const { cardId } = await createCardMarketFixture(database);
  const user = await createUser(database, identity, 300);
  const headers = { authorization: `Bearer ${internalToken}` };

  const purchase = await app.inject({
    method: 'POST',
    url: `/v1/cards/${cardId}/purchase`,
    headers,
    payload: { identity },
  });
  expect(purchase.statusCode).toBe(200);
  expect(purchase.json()).toMatchObject({ balance: 100, price: 200 });
  const { userCardId } = purchase.json<{ userCardId: string }>();

  const acquired = await database.db.query.userCards.findFirst({
    where: database.eq(database.schema.userCards.id, userCardId),
  });
  expect(acquired).toMatchObject({ userId: user.id, cardId, claimedBy: 'hire' });

  const sale = await app.inject({
    method: 'POST',
    url: '/v1/cards/sell',
    headers,
    payload: { identity, userCardIds: [userCardId] },
  });
  expect(sale.statusCode).toBe(200);
  expect(sale.json()).toEqual({ userCardIds: [userCardId], balance: 120, amount: 20 });

  const sold = await database.db.query.userCards.findFirst({
    where: database.eq(database.schema.userCards.id, userCardId),
  });
  expect(sold).toBeUndefined();
  const persistedUser = await database.db.query.users.findFirst({
    where: database.eq(database.schema.users.id, user.id),
  });
  expect(persistedUser?.saldo).toBe(120);
  const history = await database.db.query.transactionHistory.findMany({
    where: database.eq(database.schema.transactionHistory.userId, user.id),
  });
  expect(history.map((entry) => [entry.type, entry.amount])).toEqual([
    ['purchase', -200],
    ['sale', 20],
  ]);
});
