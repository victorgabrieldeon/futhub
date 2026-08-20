import { afterAll, beforeAll, expect, test } from 'vitest';

import { internalToken, type E2eContext, startE2eContext } from '../../../test/e2e/context.js';

const identity = { id: 'e2e-missions-user', name: 'Mission player', avatarUrl: null };
let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

async function createMission(
  database: NonNullable<typeof context>['database'],
  cadence: 'daily' | 'weekly' | 'monthly',
  title: string,
): Promise<void> {
  const [text] = await database.db
    .insert(database.schema.localizedTexts)
    .values({})
    .returning({ id: database.schema.localizedTexts.id });
  if (!text) throw new Error('Failed to create mission title.');
  await database.db.insert(database.schema.localizedTextTranslations).values({
    localizedTextId: text.id,
    locale: 'pt-BR',
    content: title,
  });
  const [item] = await database.db
    .insert(database.schema.items)
    .values({ type: 'balance', amount: 25 })
    .returning({ id: database.schema.items.id });
  if (!item) throw new Error('Failed to create mission reward.');
  const [mission] = await database.db
    .insert(database.schema.missions)
    .values({ titleTextId: text.id, type: 'claim_profit', cadence, tier: 1, goal: 1 })
    .returning({ id: database.schema.missions.id });
  if (!mission) throw new Error('Failed to create mission.');
  await database.db.insert(database.schema.missionRewards).values({
    missionId: mission.id,
    itemId: item.id,
    tier: 1,
  });
}

test('atribui missões de cada ciclo e concede recompensa ao concluir', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  await createMission(database, 'daily', 'Lucro diário');
  await createMission(database, 'weekly', 'Lucro semanal');
  await createMission(database, 'monthly', 'Lucro mensal');
  const headers = { authorization: `Bearer ${internalToken}` };

  const missions = await app.inject({
    method: 'POST',
    url: '/v1/missions',
    headers,
    payload: identity,
  });
  expect(missions.statusCode).toBe(200);
  const missionList = missions.json<{
    missions: { cadence: string; progress: number; title: string }[];
  }>();
  expect(missionList.missions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ cadence: 'daily', progress: 0, title: 'Lucro diário' }),
      expect.objectContaining({ cadence: 'weekly', progress: 0, title: 'Lucro semanal' }),
      expect.objectContaining({ cadence: 'monthly', progress: 0, title: 'Lucro mensal' }),
    ]),
  );

  const lucro = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers,
    payload: identity,
  });
  expect(lucro.statusCode).toBe(200);
  expect(lucro.json<{ kind: string }>().kind).toBe('success');

  const user = await database.db.query.users.findFirst({
    where: database.eq(database.schema.users.discordUserId, identity.id),
  });
  if (!user) throw new Error('E2E user was not persisted.');
  const daily = await database.db.query.userMissions.findFirst({
    where: (row, { and, eq }) =>
      and(
        eq(row.userId, user.id),
        eq(row.cadence, 'daily'),
        eq(row.periodKey, new Date().toISOString().slice(0, 10)),
      ),
  });
  expect(daily).toMatchObject({ progress: 1, claimedAt: expect.any(Date) });
  expect(user.saldo).toBeGreaterThanOrEqual(75);
});
