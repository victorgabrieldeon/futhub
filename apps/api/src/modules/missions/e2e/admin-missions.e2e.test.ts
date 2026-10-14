import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  type E2eContext,
  adminToken,
  internalToken,
  startE2eContext,
} from '../../../test/e2e/context.js';
import { createPackFixture } from '../../../test/e2e/entities.js';

let context: E2eContext;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

function admin(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) {
  return context.app.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${adminToken}`,
      'x-admin-request': '1',
      ...(payload ? { 'content-type': 'application/json' } : {}),
    },
    payload: payload ? JSON.stringify(payload) : undefined,
  });
}

test('exige autenticação de admin', async () => {
  const response = await context.app.inject({ method: 'GET', url: '/v1/admin/missions' });

  expect(response.statusCode).toBe(401);
});

test('gerencia missões e congela regras depois da primeira atribuição', async () => {
  const { db, eq, schema } = context.database;
  const { packId } = await createPackFixture(context.database);

  const options = await admin('GET', '/v1/admin/missions/options');
  expect(options.statusCode).toBe(200);
  expect(options.json().packs).toContainEqual({ id: packId, name: 'E2E pack' });

  const input = {
    title: '  Abra 3 packs  ',
    type: 'open_pack',
    cadence: 'daily',
    tier: 1,
    goal: 3,
    active: true,
    rewards: [
      { type: 'balance', amount: 100, resourceId: null },
      { type: 'pack', amount: 1, resourceId: packId },
    ],
  };
  const created = await admin('POST', '/v1/admin/missions', input);
  expect(created.statusCode).toBe(201);
  const mission = created.json();
  expect(mission).toMatchObject({
    title: 'Abra 3 packs',
    type: 'open_pack',
    cadence: 'daily',
    tier: 1,
    goal: 3,
    active: true,
    assignments: 0,
    locked: false,
  });
  expect(mission.rewards).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'balance', amount: 100, resourceId: null }),
      expect.objectContaining({
        type: 'pack',
        amount: 1,
        resourceId: packId,
        resourceName: 'E2E pack',
      }),
    ]),
  );
  const [stored] = await db
    .select()
    .from(schema.missions)
    .where(eq(schema.missions.id, mission.id));
  expect(stored).toMatchObject({ type: 'open_pack', cadence: 'daily', goal: 3, active: true });
  const pool = await db
    .select()
    .from(schema.missionRewards)
    .where(eq(schema.missionRewards.missionId, mission.id));
  expect(pool).toHaveLength(2);

  const invalid = await admin('POST', '/v1/admin/missions', {
    ...input,
    rewards: [{ type: 'pack', amount: 1, resourceId: null }],
  });
  expect(invalid.statusCode).toBe(400);
  const repeated = await admin('POST', '/v1/admin/missions', {
    ...input,
    rewards: [input.rewards[0], input.rewards[0]],
  });
  expect(repeated.statusCode).toBe(400);

  const balanceItemId = mission.rewards.find(
    (reward: { type: string }) => reward.type === 'balance',
  ).itemId;
  const edited = await admin('PUT', `/v1/admin/missions/${mission.id}`, {
    ...input,
    title: 'Abra 4 packs',
    goal: 4,
    rewards: [input.rewards[0], { type: 'balance', amount: 50, resourceId: null }],
  });
  expect(edited.statusCode).toBe(200);
  expect(edited.json()).toMatchObject({ title: 'Abra 4 packs', goal: 4 });
  expect(edited.json().rewards).toHaveLength(2);
  expect(edited.json().rewards).toContainEqual(
    expect.objectContaining({ itemId: balanceItemId, amount: 100 }),
  );
  const packItems = await db.select().from(schema.items).where(eq(schema.items.packId, packId));
  expect(packItems).toHaveLength(0);

  const assigned = await context.app.inject({
    method: 'POST',
    url: '/v1/missions',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: { id: 'e2e-admin-missions-player', name: 'Jogador', avatarUrl: null },
  });
  expect(assigned.statusCode).toBe(200);
  expect(assigned.json().missions).toContainEqual(
    expect.objectContaining({ title: 'Abra 4 packs', goal: 4 }),
  );

  const [locked] = (await admin('GET', '/v1/admin/missions')).json();
  expect(locked).toMatchObject({ id: mission.id, assignments: 1, locked: true });
  const frozen = await admin('PUT', `/v1/admin/missions/${mission.id}`, {
    ...input,
    goal: 10,
  });
  expect(frozen.statusCode).toBe(409);
  const deactivated = await admin('PUT', `/v1/admin/missions/${mission.id}`, {
    ...input,
    title: 'Abra 4 packs',
    goal: 4,
    active: false,
    rewards: [{ type: 'balance', amount: 75, resourceId: null }],
  });
  expect(deactivated.statusCode).toBe(200);
  expect(deactivated.json()).toMatchObject({ active: false, rewards: [{ amount: 75 }] });
  const blocked = await admin('DELETE', `/v1/admin/missions/${mission.id}`);
  expect(blocked.statusCode).toBe(409);
  const [assignment] = await db
    .select({ rewardItemId: schema.userMissions.rewardItemId })
    .from(schema.userMissions)
    .where(eq(schema.userMissions.missionId, mission.id));
  const [drawnItem] = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .where(eq(schema.items.id, assignment?.rewardItemId ?? ''));
  expect(drawnItem).toBeDefined();

  const draft = (
    await admin('POST', '/v1/admin/missions', { ...input, type: 'win_match', cadence: 'monthly' })
  ).json();
  const removed = await admin('DELETE', `/v1/admin/missions/${draft.id}`);
  expect(removed.statusCode).toBe(200);
  expect(
    await db.select().from(schema.missions).where(eq(schema.missions.id, draft.id)),
  ).toHaveLength(0);
});
