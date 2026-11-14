import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  type E2eContext,
  playerSessionSecret,
  startE2eContext,
} from '../../../test/e2e/context.js';
import { createUser } from '../../../test/e2e/entities.js';
import { createPlayerSession } from '../player-session.js';

const player = { id: 'e2e-auth-routes-player', name: 'Auth routes player', avatarUrl: null };
const discordEnv = {
  DISCORD_CLIENT_ID: 'e2e-client-id',
  DISCORD_CLIENT_SECRET: 'e2e-client-secret',
  PLAYER_DISCORD_REDIRECT_URI: 'https://play.test/v1/auth/player/discord/callback',
  PLAYER_APP_URL: 'https://play.test',
};
const previousEnv = Object.fromEntries(
  Object.keys(discordEnv).map((name) => [name, process.env[name]]),
);
let context: E2eContext | undefined;

beforeAll(async () => {
  Object.assign(process.env, discordEnv);
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
  for (const [name, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('rotas de autenticação do jogador estão montadas e a sessão do cookie vira Bearer', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  await createUser(database, player, 250);
  const token = createPlayerSession(
    { ...player, balance: 250, expiresAt: Date.now() + 60 * 60_000 },
    playerSessionSecret,
  );

  // Navegadores só seguem `location` em 3xx: o login web depende do 302.
  const login = await app.inject({ method: 'GET', url: '/v1/auth/player/discord' });
  expect(login.statusCode).toBe(302);
  expect(login.headers.location).toMatch(/^https:\/\/discord\.com\/oauth2\/authorize\?/);
  expect(String(login.headers['set-cookie'])).toContain('futhub_discord_oauth_state=');

  const config = await app.inject({ method: 'GET', url: '/v1/auth/player/activity' });
  expect(config.statusCode).toBe(200);
  expect(config.json()).toEqual({ clientId: 'e2e-client-id', storageHost: 'minio.test' });

  const anonymous = await app.inject({ method: 'GET', url: '/v1/auth/player/session' });
  expect(anonymous.statusCode).toBe(401);

  const session = await app.inject({
    method: 'GET',
    url: '/v1/auth/player/session',
    headers: { cookie: `futhub_player_session=${encodeURIComponent(token)}` },
  });
  expect(session.statusCode).toBe(200);
  expect(session.json()).toMatchObject({ ...player, balance: 250, token });

  // O token devolvido autentica as rotas de jogo pela identidade da sessão.
  const missions = await app.inject({
    method: 'POST',
    url: '/v1/missions',
    headers: { authorization: `Bearer ${session.json<{ token: string }>().token}` },
    payload: player,
  });
  expect(missions.statusCode).toBe(200);
  const stored = await database.db.query.users.findFirst({
    where: database.eq(database.schema.users.discordUserId, player.id),
  });
  expect(stored?.saldo).toBe(250);

  const invalidCode = await app.inject({
    method: 'POST',
    url: '/v1/auth/player/activity',
    payload: { code: '' },
  });
  expect(invalidCode.statusCode).toBe(400);
});
