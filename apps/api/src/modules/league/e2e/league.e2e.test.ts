import { afterAll, beforeAll, expect, test } from 'vitest';

import { type E2eContext, internalToken, startE2eContext } from '../../../test/e2e/context.js';
import { createLeaguePlayer } from '../../../test/e2e/entities.js';
import type { TestMatchResponse } from '../league.dto.js';

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

test('simula partida de teste contra CPU e jogador sem persistir resultado', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const headers = { authorization: `Bearer ${internalToken}` };
  const owner = { id: 'e2e-league-test-owner', name: 'Test owner', avatarUrl: null };
  const rival = { id: 'e2e-league-test-rival', name: 'Test rival', avatarUrl: null };
  await createLeaguePlayer(database, owner);
  await createLeaguePlayer(database, rival);
  const snapshot = async () =>
    (
      await Promise.all([
        database.db.query.users.findMany(),
        database.db.query.cards.findMany(),
        database.db.query.cardStats.findMany(),
        database.db.query.userCards.findMany(),
        database.db.query.userFormations.findMany(),
        database.db.query.userLeagueStandings.findMany(),
        database.db.query.rankedQueues.findMany(),
        database.db.query.rooms.findMany(),
        database.db.query.roomMatchEvents.findMany(),
        database.db.query.userMissions.findMany(),
      ])
    ).map((rows) => rows.map((row) => JSON.stringify(row)).sort());
  const before = await snapshot();

  const cpu = await app.inject({
    method: 'POST',
    url: '/v1/matches/test',
    headers,
    payload: { identity: owner, opponentId: null, seed: 1234 },
  });
  expect(cpu.statusCode).toBe(200);
  const cpuMatch = cpu.json<TestMatchResponse>();
  expect(cpuMatch).toMatchObject({
    seed: 1234,
    difficulty: 'medium',
    home: { name: owner.name, cpu: false, tactic: 'balanced', rating: 80 },
    away: { name: 'FutHub CPU', cpu: true },
  });
  expect(cpuMatch.away.lineup).toHaveLength(11);
  expect(cpuMatch.home.lineup).toContainEqual({
    name: 'Test owner 0',
    position: cpuMatch.home.slots[0]?.position,
    overall: 80,
    imageUrl: null,
  });
  expect(cpuMatch.home.slots).toHaveLength(11);
  expect(cpuMatch.away.slots).toEqual(cpuMatch.home.slots);
  expect(cpuMatch.events[0]).toMatchObject({ type: 'kickoff', homeGoals: 0, awayGoals: 0 });
  expect(cpuMatch.events.at(-1)).toMatchObject({
    type: 'fulltime',
    homeGoals: cpuMatch.homeGoals,
    awayGoals: cpuMatch.awayGoals,
  });

  const repeated = await app.inject({
    method: 'POST',
    url: '/v1/matches/test',
    headers,
    payload: { identity: owner, opponentId: null, seed: 1234 },
  });
  expect(repeated.json()).toEqual(cpuMatch);

  for (const [difficulty, rating] of [
    ['easy', 64],
    ['medium', 80],
    ['hard', 96],
  ] as const) {
    const payload = { identity: owner, seed: 1234, difficulty };
    const response = await app.inject({
      method: 'POST',
      url: '/v1/matches/test',
      headers,
      payload,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ difficulty, away: { cpu: true, rating } });
    if (difficulty === 'medium') expect(response.json()).toEqual(cpuMatch);
    const repeated = await app.inject({
      method: 'POST',
      url: '/v1/matches/test',
      headers,
      payload,
    });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json()).toEqual(response.json());
  }

  const defaults = await app.inject({
    method: 'POST',
    url: '/v1/matches/test',
    headers,
    payload: { identity: owner },
  });
  expect(defaults.statusCode).toBe(200);
  expect(defaults.json()).toMatchObject({ difficulty: 'medium', away: { rating: 80 } });
  expect(defaults.json<TestMatchResponse>().seed).toBeGreaterThan(0);
  expect(defaults.json<TestMatchResponse>().seed).toBeLessThanOrEqual(2_147_483_647);

  const versus = await app.inject({
    method: 'POST',
    url: '/v1/matches/test',
    headers,
    payload: { identity: owner, opponentId: rival.id, seed: 1234 },
  });
  expect(versus.statusCode).toBe(200);
  expect(versus.json()).toMatchObject({
    difficulty: null,
    home: { name: owner.name, cpu: false },
    away: { name: rival.name, cpu: false },
  });

  const humanWithDifficulty = await app.inject({
    method: 'POST',
    url: '/v1/matches/test',
    headers,
    payload: { identity: owner, opponentId: rival.id, seed: 1234, difficulty: 'hard' },
  });
  expect(humanWithDifficulty.statusCode).toBe(200);
  expect(humanWithDifficulty.json()).toEqual(versus.json());

  for (const difficulty of [null, '', 'Easy', 'expert', 1, true, {}, ['easy']]) {
    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/matches/test',
      headers,
      payload: { identity: owner, difficulty },
    });
    expect(invalid.statusCode).toBe(400);
  }

  const self = await app.inject({
    method: 'POST',
    url: '/v1/matches/test',
    headers,
    payload: { identity: owner, opponentId: owner.id },
  });
  expect(self.statusCode).toBe(400);

  expect(await snapshot()).toEqual(before);
});

test('rejeita partida de teste com escalação incompleta', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const player = { id: 'e2e-league-test-incomplete', name: 'Test incomplete', avatarUrl: null };
  await createLeaguePlayer(database, player, { holderCount: 9 });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/matches/test',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: { identity: player },
  });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({
    message:
      'Complete a escalação com 11 titulares em posições compatíveis antes de buscar uma partida.',
  });
});
