import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { type E2eContext, internalToken, startE2eContext } from '../../../test/e2e/context.js';
import { createCardMarketFixture, createUser } from '../../../test/e2e/entities.js';
import { FilesService } from '../../files/files.service.js';

const identity = { id: 'e2e-card-market-user', name: 'Market player', avatarUrl: null };
let context: E2eContext | undefined;
let fixture: Awaited<ReturnType<typeof createCardMarketFixture>> | undefined;

beforeAll(async () => {
  context = await startE2eContext();
  vi.spyOn(FilesService.prototype, 'urls').mockImplementation(
    async (fileIds) => new Map(fileIds.map((fileId) => [fileId, `https://images.test/${fileId}`])),
  );
  vi.spyOn(FilesService.prototype, 'defaultCardImage').mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000001',
    url: 'https://images.test/default.webp',
    contentType: 'image/webp',
    sizeBytes: 1,
    width: null,
    height: null,
  });
  fixture = await createCardMarketFixture(context.database);
}, 300_000);

afterAll(async () => {
  await context?.close();
  vi.restoreAllMocks();
});

test('compra e vende card, persistindo inventário, saldo e histórico', async () => {
  if (!context || !fixture) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const { cardId } = fixture;
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

test('lista apenas cards elegíveis com filtros, preço, paginação e ordem determinística', async () => {
  if (!context || !fixture) throw new Error('E2E context was not initialized.');
  const marketFixture = fixture;
  const url = `/v1/cards?page=1&positions=MA,CA,MA&minOverall=80&maxOverall=90&teamId=${marketFixture.teamId}&collectionId=${marketFixture.collectionId}&sort=overall`;
  const response = await context.app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${internalToken}` },
  });

  expect(response.statusCode, response.body).toBe(200);
  const body = response.json<{
    items: readonly {
      id: string;
      name: string;
      overall: number;
      position: string;
      secondaryPositions: readonly string[];
      price: number;
      imageUrl: string;
      team: { id: string; name: string; emoji: string };
      collection: { id: string; name: string; emoji: string };
    }[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>();
  expect(body).toMatchObject({ page: 1, pageSize: 10, totalPages: 1, total: 3 });
  expect(body.items.map((item) => [item.name, item.overall])).toEqual([
    ['Market tie', 90],
    ['Market tie', 90],
    ['Market card', 80],
  ]);
  expect(body.items.slice(0, 2).map((item) => item.id)).toEqual(
    [marketFixture.eligibleCardIds[1], marketFixture.eligibleCardIds[2]].sort(),
  );
  expect(body.items.find((item) => item.secondaryPositions.includes('MA'))).toMatchObject({
    id: marketFixture.secondaryPositionCardId,
    position: 'MC',
    secondaryPositions: ['MA'],
    price: 400,
    team: { id: marketFixture.teamId, emoji: '⚽' },
    collection: { id: marketFixture.collectionId, emoji: '⚽' },
  });
  expect(body.items.every((item) => item.imageUrl.startsWith('https://images.test/'))).toBe(true);
  expect(body.items.every((item) => marketFixture.eligibleCardIds.includes(item.id))).toBe(true);

  const repeatedPositions = await context.app.inject({
    method: 'GET',
    url: `/v1/cards?page=1&positions=MA&positions=CA&teamId=${marketFixture.teamId}`,
    headers: { authorization: `Bearer ${internalToken}` },
  });
  expect(repeatedPositions.statusCode, repeatedPositions.body).toBe(200);
  expect(repeatedPositions.json<{ total: number }>().total).toBe(3);

  const persisted = await context.database.db
    .select({
      id: context.database.schema.cards.id,
      blocked: context.database.schema.cards.contractsBlocked,
    })
    .from(context.database.schema.cards)
    .where(
      context.database.inArray(context.database.schema.cards.id, [
        ...marketFixture.eligibleCardIds,
        marketFixture.blockedCardId,
      ]),
    );
  expect(persisted).toHaveLength(marketFixture.eligibleCardIds.length + 1);
  expect(persisted.find((card) => card.id === marketFixture.blockedCardId)?.blocked).toBe(true);
});

test('retorna catálogo apenas de opções elegíveis em ordem estável', async () => {
  if (!context || !fixture) throw new Error('E2E context was not initialized.');
  const response = await context.app.inject({
    method: 'GET',
    url: '/v1/cards/catalog',
    headers: { authorization: `Bearer ${internalToken}` },
  });

  expect(response.statusCode, response.body).toBe(200);
  const body = response.json<{
    teams: readonly { id: string; name: string; emoji: string }[];
    collections: readonly { id: string; name: string; emoji: string }[];
  }>();
  expect(body.teams).toContainEqual({
    id: fixture.teamId,
    name: expect.stringContaining('market team'),
    emoji: '⚽',
  });
  expect(body.collections).toContainEqual({
    id: fixture.collectionId,
    name: expect.stringContaining('market collection'),
    emoji: '⚽',
  });
  expect(body.teams.map((team) => team.name)).toEqual(
    [...body.teams.map((team) => team.name)].sort((left, right) => left.localeCompare(right)),
  );
  expect(body.collections.map((collection) => collection.name)).toEqual(
    [...body.collections.map((collection) => collection.name)].sort((left, right) =>
      left.localeCompare(right),
    ),
  );
});

test.each([
  'page=0',
  'page=1.5',
  'positions=INVALID',
  'positions=CA,,MA',
  'minOverall=59',
  'maxOverall=101',
  'minOverall=91&maxOverall=90',
  'teamId=not-a-uuid',
  'collectionId=not-a-uuid',
  'sort=price',
])('rejeita query malformada: %s', async (query) => {
  if (!context) throw new Error('E2E context was not initialized.');
  const response = await context.app.inject({
    method: 'GET',
    url: `/v1/cards?${query}`,
    headers: { authorization: `Bearer ${internalToken}` },
  });
  expect(response.statusCode, response.body).toBe(400);
});

test('normaliza página acima do total, inclusive após mudança de elegibilidade', async () => {
  if (!context || !fixture) throw new Error('E2E context was not initialized.');
  const marketFixture = fixture;
  const url = `/v1/cards?page=99&teamId=${marketFixture.teamId}&sort=recent`;
  const first = await context.app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${internalToken}` },
  });
  expect(first.statusCode, first.body).toBe(200);
  const firstBody = first.json<{
    items: readonly { id: string }[];
    page: number;
    totalPages: number;
  }>();
  expect(firstBody).toMatchObject({ page: 2, totalPages: 2 });
  expect(firstBody.items).toHaveLength(4);

  await context.database.db
    .update(context.database.schema.cards)
    .set({ contractsBlocked: true })
    .where(
      context.database.inArray(
        context.database.schema.cards.id,
        firstBody.items.map((item) => item.id),
      ),
    );
  try {
    const changed = await context.app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${internalToken}` },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json()).toMatchObject({ page: 1, total: 10, totalPages: 1 });
  } finally {
    await context.database.db
      .update(context.database.schema.cards)
      .set({ contractsBlocked: false })
      .where(
        context.database.inArray(
          context.database.schema.cards.id,
          firstBody.items.map((item) => item.id),
        ),
      );
  }
});

test('retorna vazio normalizado e repete a mesma ordem', async () => {
  if (!context || !fixture) throw new Error('E2E context was not initialized.');
  const empty = await context.app.inject({
    method: 'GET',
    url: '/v1/cards?page=99&teamId=00000000-0000-4000-8000-000000000099',
    headers: { authorization: `Bearer ${internalToken}` },
  });
  expect(empty.statusCode, empty.body).toBe(200);
  expect(empty.json()).toEqual({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

  const url = `/v1/cards?page=1&teamId=${fixture.teamId}&sort=overall`;
  const [first, second] = await Promise.all([
    context.app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${internalToken}` },
    }),
    context.app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${internalToken}` },
    }),
  ]);
  expect(first.statusCode, first.body).toBe(200);
  expect(second.statusCode, second.body).toBe(200);
  expect(first.json()).toEqual(second.json());
  const fallback = await context.app.inject({
    method: 'GET',
    url: `/v1/cards?page=2&teamId=${fixture.teamId}&sort=overall`,
    headers: { authorization: `Bearer ${internalToken}` },
  });
  expect(fallback.statusCode, fallback.body).toBe(200);
  expect(fallback.json<{ items: readonly { imageUrl: string }[] }>().items).toContainEqual(
    expect.objectContaining({ imageUrl: 'https://images.test/default.webp' }),
  );
});
