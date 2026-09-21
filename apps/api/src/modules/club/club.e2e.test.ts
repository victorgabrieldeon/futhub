import { afterAll, beforeAll, expect, test } from 'vitest';

import { createUser } from '../../test/e2e/entities.js';
import { internalToken, type E2eContext, startE2eContext } from '../../test/e2e/context.js';

let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

const headers = { authorization: `Bearer ${internalToken}` };
const identity = { id: 'club-owner', name: 'Aurora FC', avatarUrl: null };

test('creates a club and returns its tycoon projection', async () => {
  if (!context) throw new Error('E2E context was not initialized.');

  const response = await context.app.inject({
    method: 'POST',
    url: '/v1/club',
    headers,
    payload: identity,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    balance: 0,
    stadium: {
      level: 1,
      maxLevel: 5,
      nextUpgradeCost: 1000,
      ticketRevenue: 200,
      maintenance: 50,
    },
    sponsor: {
      name: 'Comércio Local',
      weeklyMatches: 0,
      weeklyGoal: 3,
      payout: 300,
      completed: false,
    },
    payroll: 0,
    projectedNet: 150,
  });

  const user = await context.database.db.query.users.findFirst({
    where: context.database.eq(context.database.schema.users.discordUserId, identity.id),
  });
  const club = user
    ? await context.database.db.execute<{ stadiumLevel: number }>(context.database.sql`
        select stadium_level as "stadiumLevel" from user_clubs where user_id = ${user.id}
      `)
    : undefined;
  expect(club?.rows[0]?.stadiumLevel).toBe(1);
});

test('upgrades the stadium and persists the expense', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const upgradeIdentity = { id: 'club-upgrade-owner', name: 'Upgrade FC', avatarUrl: null };
  const user = await createUser(context.database, upgradeIdentity, 1000);

  const response = await context.app.inject({
    method: 'POST',
    url: '/v1/club/stadium/upgrade',
    headers,
    payload: upgradeIdentity,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    balance: 0,
    stadium: { level: 2, nextUpgradeCost: 2000, ticketRevenue: 400, maintenance: 100 },
  });

  const [persistedClub, persistedUser, transaction] = await Promise.all([
    context.database.db.execute<{ stadiumLevel: number }>(context.database.sql`
      select stadium_level as "stadiumLevel" from user_clubs where user_id = ${user.id}
    `),
    context.database.db.query.users.findFirst({
      where: context.database.eq(context.database.schema.users.id, user.id),
    }),
    context.database.db.query.transactionHistory.findFirst({
      where: context.database.eq(context.database.schema.transactionHistory.userId, user.id),
    }),
  ]);
  expect(persistedClub.rows[0]?.stadiumLevel).toBe(2);
  expect(persistedUser?.saldo).toBe(0);
  expect(transaction).toMatchObject({ type: 'purchase', amount: -1000 });
});
