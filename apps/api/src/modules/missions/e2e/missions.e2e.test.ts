import { afterAll, beforeAll, expect, test } from 'vitest';

import { type E2eContext, internalToken, startE2eContext } from '../../../test/e2e/context.js';
import { createMissionFixture, createPackFixture, createUser } from '../../../test/e2e/entities.js';

const identity = { id: 'e2e-missions-user', name: 'Mission player', avatarUrl: null };
const headers = { authorization: `Bearer ${internalToken}` };
let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('atribui missões de cada ciclo e concede recompensa ao concluir', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  for (const [cadence, title] of [
    ['daily', 'Lucro diário'],
    ['weekly', 'Lucro semanal'],
    ['monthly', 'Lucro mensal'],
  ] as const)
    await createMissionFixture(database, { title, type: 'claim_profit', cadence });

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
  const lucroBody = lucro.json<{
    kind: string;
    balance: number;
    completedMissions: { title: string; cadence: string; reward: { type: string } }[];
  }>();
  expect(lucroBody.kind).toBe('success');
  expect(lucroBody.completedMissions).toHaveLength(3);
  expect(lucroBody.completedMissions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: 'Lucro diário',
        cadence: 'daily',
        reward: expect.objectContaining({ type: 'balance', quantity: 25 }),
      }),
    ]),
  );

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
  expect(lucroBody.balance).toBe(user.saldo);
});

test('compra de pack avança missões de compra e de gasto e informa a conclusão', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const buyer = { id: 'e2e-missions-buyer', name: 'Comprador', avatarUrl: null };
  const { packId } = await createPackFixture(database);
  await createUser(database, buyer, 100);
  await createMissionFixture(database, {
    title: 'Compre um pack',
    type: 'buy_pack',
    cadence: 'weekly',
    tier: 2,
  });
  await createMissionFixture(database, {
    title: 'Gaste 50 moedas',
    type: 'spend_balance',
    cadence: 'monthly',
    tier: 2,
    goal: 50,
    reward: { type: 'pack', amount: 1, packId },
  });

  const first = await app.inject({
    method: 'POST',
    url: `/v1/packs/${packId}/purchase`,
    headers,
    payload: { identity: buyer },
  });
  expect(first.statusCode).toBe(200);
  expect(first.json()).toMatchObject({
    balance: 105,
    quantity: 1,
    completedMissions: [
      { title: 'Compre um pack', cadence: 'weekly', reward: { type: 'balance', quantity: 25 } },
    ],
  });

  const second = await app.inject({
    method: 'POST',
    url: `/v1/packs/${packId}/purchase`,
    headers,
    payload: { identity: buyer },
  });
  expect(second.statusCode).toBe(200);
  expect(second.json()).toMatchObject({
    balance: 85,
    quantity: 2,
    completedMissions: [],
  });

  const third = await app.inject({
    method: 'POST',
    url: `/v1/packs/${packId}/purchase`,
    headers,
    payload: { identity: buyer },
  });
  expect(third.json()).toMatchObject({
    balance: 65,
    quantity: 4,
    completedMissions: [
      { title: 'Gaste 50 moedas', cadence: 'monthly', reward: { type: 'pack', quantity: 1 } },
    ],
  });

  const user = await database.db.query.users.findFirst({
    where: database.eq(database.schema.users.discordUserId, buyer.id),
  });
  if (!user) throw new Error('E2E buyer was not persisted.');
  expect(user.saldo).toBe(65);
  const spend = await database.db
    .select({ progress: database.schema.userMissions.progress })
    .from(database.schema.userMissions)
    .innerJoin(
      database.schema.missions,
      database.eq(database.schema.userMissions.missionId, database.schema.missions.id),
    )
    .where(
      database.and(
        database.eq(database.schema.userMissions.userId, user.id),
        database.eq(database.schema.missions.type, 'spend_balance'),
      ),
    );
  expect(spend).toEqual([{ progress: 50 }]);
});
