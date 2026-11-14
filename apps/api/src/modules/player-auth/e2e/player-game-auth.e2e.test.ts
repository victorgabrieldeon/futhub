import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  type E2eContext,
  internalToken,
  playerSessionSecret,
  startE2eContext,
} from '../../../test/e2e/context.js';
import { createTeamPlayer, createUser } from '../../../test/e2e/entities.js';
import { createPlayerSession } from '../player-session.js';

const player = { id: 'e2e-activity-player', name: 'Activity player', avatarUrl: null };
const victim = { id: 'e2e-activity-victim', name: 'Victim', avatarUrl: null };
const cardOwner = { id: 'e2e-activity-owner', name: 'Card owner', avatarUrl: null };
const playerHeaders = {
  authorization: `Bearer ${createPlayerSession(
    { ...player, balance: 0, expiresAt: Date.now() + 60 * 60_000 },
    playerSessionSecret,
  )}`,
};
let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('sessão de jogador só age pela própria identidade nas rotas de jogo', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const { db, eq, schema } = database;
  await createUser(database, victim, 100);
  const balanceOf = async (discordUserId: string) =>
    (
      await db
        .select({ saldo: schema.users.saldo, nome: schema.users.nome })
        .from(schema.users)
        .where(eq(schema.users.discordUserId, discordUserId))
    )[0];

  const spoofedId = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers: playerHeaders,
    payload: victim,
  });
  expect(spoofedId.statusCode).toBe(403);
  expect(await balanceOf(victim.id)).toEqual({ saldo: 100, nome: victim.name });

  const spoofedName = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers: playerHeaders,
    payload: { ...player, name: 'Admin', identity: victim },
  });
  expect(spoofedName.statusCode).toBe(200);
  const lucro = spoofedName.json<{ kind: string; balance: number }>();
  expect(lucro.kind).toBe('success');
  expect(await balanceOf(player.id)).toEqual({ saldo: lucro.balance, nome: player.name });

  const nested = await app.inject({
    method: 'POST',
    url: '/v1/team',
    headers: playerHeaders,
    payload: { identity: victim },
  });
  expect(nested.statusCode).toBe(200);
  expect(await balanceOf(victim.id)).toEqual({ saldo: 100, nome: victim.name });

  const { reserveUserCardId } = await createTeamPlayer(database, cardOwner);
  const cardOf = () =>
    db.query.userCards.findFirst({ where: eq(schema.userCards.id, reserveUserCardId) });
  const before = await cardOf();
  const favorite = await app.inject({
    method: 'PUT',
    url: `/v1/team/cards/${reserveUserCardId}/favorite`,
    headers: playerHeaders,
    payload: { identity: player },
  });
  expect(favorite.statusCode).toBe(400);
  const sell = await app.inject({
    method: 'POST',
    url: '/v1/cards/sell',
    headers: playerHeaders,
    payload: { identity: player, userCardIds: [reserveUserCardId] },
  });
  expect(sell.statusCode).toBeGreaterThanOrEqual(400);
  expect(await cardOf()).toEqual(before);
  expect(await balanceOf(player.id)).toEqual({ saldo: lucro.balance, nome: player.name });

  const otherStatus = await app.inject({
    method: 'GET',
    url: `/v1/ranked/status/${victim.id}`,
    headers: playerHeaders,
  });
  expect(otherStatus.statusCode).toBe(403);
  const ownStatus = await app.inject({
    method: 'GET',
    url: `/v1/ranked/status/${player.id}`,
    headers: playerHeaders,
  });
  expect(ownStatus.statusCode).toBe(200);

  const forged = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers: { authorization: `${playerHeaders.authorization}x` },
    payload: player,
  });
  expect(forged.statusCode).toBe(401);
  const botOnly = await app.inject({
    method: 'GET',
    url: '/v1/bot-emojis',
    headers: playerHeaders,
  });
  expect(botOnly.statusCode).toBe(401);
  const bot = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: victim,
  });
  expect(bot.statusCode).toBe(200);
});
