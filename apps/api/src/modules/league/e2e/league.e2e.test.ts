import { afterAll, beforeAll, expect, test } from 'vitest';

import { type E2eContext, internalToken, startE2eContext } from '../../../test/e2e/context.js';
import { createLeaguePlayer } from '../../../test/e2e/entities.js';

const newcomer = { id: 'e2e-league-newcomer', name: 'New player', avatarUrl: null };
const home = { id: 'e2e-league-home', name: 'Home player', avatarUrl: null };
const away = { id: 'e2e-league-away', name: 'Away player', avatarUrl: null };
const incomplete = { id: 'e2e-league-incomplete', name: 'Incomplete player', avatarUrl: null };
let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('abre a liga, evita autocombate e permite nova busca após o resultado', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const headers = { authorization: `Bearer ${internalToken}` };

  const opened = await app.inject({
    method: 'POST',
    url: '/v1/league',
    headers,
    payload: newcomer,
  });
  expect(opened.statusCode).toBe(200);
  expect(opened.json()).toMatchObject({
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    division: { name: 'Bronze' },
    queue: null,
  });
  const newcomerUser = await database.db.query.users.findFirst({
    columns: { id: true },
    where: database.eq(database.schema.users.discordUserId, newcomer.id),
  });
  expect(newcomerUser).toBeDefined();
  const newcomerStanding = newcomerUser
    ? await database.db.query.userLeagueStandings.findFirst({
        where: database.eq(database.schema.userLeagueStandings.userId, newcomerUser.id),
      })
    : undefined;
  expect(newcomerStanding).toMatchObject({ points: 0, wins: 0, draws: 0, losses: 0 });

  const homeUser = await createLeaguePlayer(database, home);
  const awayUser = await createLeaguePlayer(database, away);
  const homeDefender = await database.db.query.userCards.findFirst({
    where: database.and(
      database.eq(database.schema.userCards.userId, homeUser.id),
      database.eq(database.schema.userCards.holderPosition, 'LD'),
    ),
  });
  if (!homeDefender) throw new Error('Home defender was not created.');
  await database.db
    .update(database.schema.cards)
    .set({ position: 'MA' })
    .where(database.eq(database.schema.cards.id, homeDefender.cardId));
  await database.db.insert(database.schema.cardSecondaryPositions).values({
    cardId: homeDefender.cardId,
    position: 'LD',
  });
  const firstQueue = await app.inject({
    method: 'POST',
    url: '/v1/ranked/queue',
    headers,
    payload: home,
  });
  expect(firstQueue.statusCode).toBe(200);
  expect(firstQueue.json()).toMatchObject({ kind: 'waiting', division: { name: 'Bronze' } });

  const repeatedQueue = await app.inject({
    method: 'POST',
    url: '/v1/ranked/queue',
    headers,
    payload: home,
  });
  expect(repeatedQueue.statusCode).toBe(200);
  expect(repeatedQueue.json()).toMatchObject({ kind: 'waiting' });
  expect(await database.db.query.rooms.findMany()).toHaveLength(0);

  const secondQueue = await app.inject({
    method: 'POST',
    url: '/v1/ranked/queue',
    headers,
    payload: away,
  });
  expect(secondQueue.statusCode).toBe(200);
  const queue = secondQueue.json<{ kind: string; matchId?: string }>();
  expect(queue.kind).toBe('matched');
  expect(queue.matchId).toEqual(expect.any(String));
  if (!queue.matchId) throw new Error('Match id was not returned.');

  const match = await app.inject({
    method: 'GET',
    url: `/v1/matches/${queue.matchId}`,
    headers,
  });
  expect(match.statusCode).toBe(200);
  expect(match.json()).toMatchObject({
    id: queue.matchId,
    home,
    away,
  });
  expect(match.json<{ events: unknown[] }>().events).toEqual(
    expect.arrayContaining([expect.objectContaining({ minute: 0, type: 'kickoff' })]),
  );
  for (const user of [homeUser, awayUser]) {
    const holders = await database.db.query.userCards.findMany({
      where: database.and(
        database.eq(database.schema.userCards.userId, user.id),
        database.eq(database.schema.userCards.holder, true),
      ),
    });
    expect(holders).toHaveLength(11);
    expect(holders.every(({ matches }) => matches === 1)).toBe(true);
  }

  for (const identity of [home, away]) {
    const standing = await app.inject({
      method: 'GET',
      url: `/v1/league/${identity.id}`,
      headers,
    });
    expect(standing.statusCode).toBe(200);
    expect(standing.json()).toMatchObject({
      division: { name: 'Bronze' },
      queue: { kind: 'matched', matchId: queue.matchId },
    });
    const campaign = standing.json<{ wins: number; draws: number; losses: number }>();
    expect(campaign.wins + campaign.draws + campaign.losses).toBe(1);
  }

  const requeued = await app.inject({
    method: 'POST',
    url: '/v1/ranked/queue',
    headers,
    payload: home,
  });
  expect(requeued.statusCode).toBe(200);
  expect(requeued.json()).toMatchObject({ kind: 'waiting', division: { name: 'Bronze' } });
  expect(
    await database.db.query.rankedQueues.findFirst({
      where: database.eq(database.schema.rankedQueues.userId, homeUser.id),
    }),
  ).toMatchObject({ status: 'waiting', roomId: null });
  expect(
    await database.db.query.rankedQueues.findFirst({
      where: database.eq(database.schema.rankedQueues.userId, awayUser.id),
    }),
  ).toMatchObject({ status: 'matched', roomId: queue.matchId });
});

test('rejeita escalação incompleta sem persistir entrada na fila', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const user = await createLeaguePlayer(database, incomplete, { holderCount: 10 });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/ranked/queue',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: incomplete,
  });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({
    message:
      'Complete a escalação com 11 titulares em posições compatíveis antes de buscar uma partida.',
  });
  expect(
    await database.db.query.rankedQueues.findFirst({
      where: database.eq(database.schema.rankedQueues.userId, user.id),
    }),
  ).toBeUndefined();
});
