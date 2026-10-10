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

function redeem(code: string) {
  return context.app.inject({
    method: 'POST',
    url: '/v1/commands/resgatar',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: { identity: { id: '200000000000000001', name: 'Jogador', avatarUrl: null }, code },
  });
}

test('requires admin authentication', async () => {
  const response = await context.app.inject({ method: 'GET', url: '/v1/admin/redeem-codes' });

  expect(response.statusCode).toBe(401);
});

test('manages codes and freezes code and reward after the first Resgate', async () => {
  const { db, eq, schema } = context.database;
  const { packId } = await createPackFixture(context.database);

  const options = await admin('GET', '/v1/admin/redeem-codes/options');
  expect(options.statusCode).toBe(200);
  expect(options.json().packs).toContainEqual({ id: packId, name: 'E2E pack' });

  const input = {
    code: ' lancamento ',
    reward: { type: 'pack', amount: 2, resourceId: packId },
    maxClaims: 10,
    expiresAt: null,
    active: true,
  };
  const created = await admin('POST', '/v1/admin/redeem-codes', input);
  expect(created.statusCode).toBe(201);
  const code = created.json();
  expect(code).toMatchObject({
    code: 'LANCAMENTO',
    active: true,
    maxClaims: 10,
    claims: 0,
    locked: false,
    reward: { type: 'pack', amount: 2, resourceId: packId, resourceName: 'E2E pack' },
  });
  const [stored] = await db.select().from(schema.redeems).where(eq(schema.redeems.id, code.id));
  expect(stored).toMatchObject({ code: 'LANCAMENTO', maxClaims: 10, active: true });
  const [item] = await db
    .select()
    .from(schema.items)
    .where(eq(schema.items.id, code.reward.itemId));
  expect(item).toMatchObject({ type: 'pack', amount: 2, packId });

  const duplicate = await admin('POST', '/v1/admin/redeem-codes', input);
  expect(duplicate.statusCode).toBe(409);
  const invalid = await admin('POST', '/v1/admin/redeem-codes', { ...input, code: 'a b' });
  expect(invalid.statusCode).toBe(400);
  const missingResource = await admin('POST', '/v1/admin/redeem-codes', {
    ...input,
    code: 'SEMPACK',
    reward: { type: 'pack', amount: 1, resourceId: null },
  });
  expect(missingResource.statusCode).toBe(400);

  const expiresAt = '2030-01-01T00:00:00.000Z';
  const renamed = await admin('PUT', `/v1/admin/redeem-codes/${code.id}`, {
    ...input,
    code: 'LANCAMENTO2',
    reward: { type: 'balance', amount: 300, resourceId: null },
    expiresAt,
  });
  expect(renamed.statusCode).toBe(200);
  expect(renamed.json()).toMatchObject({
    code: 'LANCAMENTO2',
    expiresAt,
    reward: { itemId: code.reward.itemId, type: 'balance', amount: 300, resourceId: null },
  });
  const [updatedItem] = await db
    .select()
    .from(schema.items)
    .where(eq(schema.items.id, code.reward.itemId));
  expect(updatedItem).toMatchObject({ type: 'balance', amount: 300, packId: null });

  expect((await redeem('lancamento2')).json()).toMatchObject({ kind: 'success', balance: 300 });

  const listed = await admin('GET', '/v1/admin/redeem-codes');
  expect(listed.json()).toContainEqual(
    expect.objectContaining({ id: code.id, claims: 1, locked: true }),
  );

  const lockedInput = {
    code: 'LANCAMENTO2',
    reward: { type: 'balance', amount: 300, resourceId: null },
    maxClaims: 10,
    expiresAt,
    active: true,
  };
  const changedCode = await admin('PUT', `/v1/admin/redeem-codes/${code.id}`, {
    ...lockedInput,
    code: 'OUTRO',
  });
  expect(changedCode.statusCode).toBe(409);
  const changedReward = await admin('PUT', `/v1/admin/redeem-codes/${code.id}`, {
    ...lockedInput,
    reward: { type: 'balance', amount: 999, resourceId: null },
  });
  expect(changedReward.statusCode).toBe(409);
  const belowClaims = await admin('PUT', `/v1/admin/redeem-codes/${code.id}`, {
    ...lockedInput,
    maxClaims: 1,
  });
  expect(belowClaims.statusCode).toBe(200);

  const deactivated = await admin('PUT', `/v1/admin/redeem-codes/${code.id}`, {
    ...lockedInput,
    active: false,
  });
  expect(deactivated.statusCode).toBe(200);
  const [inactive] = await db.select().from(schema.redeems).where(eq(schema.redeems.id, code.id));
  expect(inactive).toMatchObject({ code: 'LANCAMENTO2', active: false });

  const deleteLocked = await admin('DELETE', `/v1/admin/redeem-codes/${code.id}`);
  expect(deleteLocked.statusCode).toBe(409);
  expect(await db.select().from(schema.redeems).where(eq(schema.redeems.id, code.id))).toHaveLength(
    1,
  );
});

test('deletes unused codes together with their dedicated Item', async () => {
  const { db, eq, schema } = context.database;
  const created = await admin('POST', '/v1/admin/redeem-codes', {
    code: 'TEMPORARIO',
    reward: { type: 'balance', amount: 10, resourceId: null },
    maxClaims: null,
    expiresAt: null,
    active: false,
  });
  const code = created.json();

  const removed = await admin('DELETE', `/v1/admin/redeem-codes/${code.id}`);

  expect(removed.statusCode).toBe(200);
  expect(await db.select().from(schema.redeems).where(eq(schema.redeems.id, code.id))).toEqual([]);
  expect(
    await db.select().from(schema.items).where(eq(schema.items.id, code.reward.itemId)),
  ).toEqual([]);
});
