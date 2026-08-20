import { afterAll, beforeAll, expect, test } from 'vitest';

import { internalToken, type E2eContext, startE2eContext } from '../../../test/e2e/context.js';
import { createLeaguePlayer } from '../../../test/e2e/entities.js';

const home = { id: 'e2e-league-home', name: 'Home player', avatarUrl: null };
const away = { id: 'e2e-league-away', name: 'Away player', avatarUrl: null };
let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('forma partida ranked e expõe placar, eventos e classificação', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  await createLeaguePlayer(database, home);
  await createLeaguePlayer(database, away);
  const headers = { authorization: `Bearer ${internalToken}` };

  const firstQueue = await app.inject({
    method: 'POST',
    url: '/v1/ranked/queue',
    headers,
    payload: home,
  });
  expect(firstQueue.statusCode).toBe(200);
  expect(firstQueue.json()).toMatchObject({ kind: 'waiting', division: { name: 'Bronze' } });

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
    homeUserId: expect.any(String),
    awayUserId: expect.any(String),
  });
  expect(match.json<{ events: unknown[] }>().events).toEqual(
    expect.arrayContaining([expect.objectContaining({ minute: 0, type: 'kickoff' })]),
  );

  const standing = await app.inject({
    method: 'GET',
    url: `/v1/league/${home.id}`,
    headers,
  });
  expect(standing.statusCode).toBe(200);
  expect(standing.json()).toMatchObject({
    division: { name: 'Bronze' },
    queue: { kind: 'matched', matchId: queue.matchId },
  });
});
