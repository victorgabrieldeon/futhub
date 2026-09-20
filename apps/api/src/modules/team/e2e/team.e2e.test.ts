import { Client } from 'minio';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { type E2eContext, internalToken, startE2eContext } from '../../../test/e2e/context.js';
import { createTeamPlayer } from '../../../test/e2e/entities.js';

const identity = { id: 'e2e-team-player', name: 'Team player', avatarUrl: null };
let context: E2eContext | undefined;

beforeAll(async () => {
  vi.stubEnv('MINIO_ENDPOINT', '127.0.0.1');
  vi.stubEnv('MINIO_PORT', '9000');
  vi.stubEnv('MINIO_ACCESS_KEY', 'test-access-key');
  vi.stubEnv('MINIO_SECRET_KEY', 'test-secret-key');
  vi.stubEnv('MINIO_BUCKET', 'test-bucket');
  vi.stubEnv('MINIO_PUBLIC_URL', 'http://files.test');
  vi.spyOn(Client.prototype, 'bucketExists').mockResolvedValue(true);
  vi.spyOn(Client.prototype, 'setBucketPolicy').mockResolvedValue();
  vi.spyOn(Client.prototype, 'putObject').mockResolvedValue({ etag: 'test-etag', versionId: null });
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('gerencia inventário, escalação, capitão e tática por HTTP e persiste o time', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  const fixture = await createTeamPlayer(database, identity);
  const headers = { authorization: `Bearer ${internalToken}` };

  const view = await app.inject({
    method: 'POST',
    url: '/v1/team',
    headers,
    payload: { identity, page: 1, name: 'Reserva', sort: 'overall' },
  });
  expect(view.statusCode).toBe(200);
  expect(view.json()).toMatchObject({
    tactic: 'balanced',
    formation: { id: fixture.formationId },
    packs: [{ id: fixture.packId, name: 'Pack do time', emoji: '📦', quantity: 2 }],
    inventory: {
      total: 1,
      items: [
        {
          userCardId: fixture.reserveUserCardId,
          imageUrl: expect.any(String),
          holder: false,
          overall: 95,
        },
      ],
    },
  });
  const [generatedCard] = await database.db
    .select({
      imageFileId: database.schema.cards.imageFileId,
      contentType: database.schema.files.contentType,
      source: database.schema.files.source,
    })
    .from(database.schema.cards)
    .leftJoin(
      database.schema.files,
      database.eq(database.schema.cards.imageFileId, database.schema.files.id),
    )
    .where(database.eq(database.schema.cards.id, fixture.reserveCardId));
  expect(generatedCard).toMatchObject({
    imageFileId: expect.any(String),
    contentType: 'image/png',
    source: 'generated',
  });

  for (const request of [
    { method: 'PUT' as const, url: '/v1/team/tactic', payload: { identity, tactic: 'offensive' } },
    { method: 'POST' as const, url: '/v1/team/lineup/auto', payload: { identity } },
    {
      method: 'PUT' as const,
      url: `/v1/team/cards/${fixture.reserveUserCardId}/favorite`,
      payload: { identity },
    },
    {
      method: 'PUT' as const,
      url: '/v1/team/captain',
      payload: { identity, userCardId: fixture.reserveUserCardId },
    },
  ]) {
    const response = await app.inject({ ...request, headers });
    expect(response.statusCode).toBe(204);
  }

  const formation = await database.db.query.userFormations.findFirst({
    where: database.eq(database.schema.userFormations.userId, fixture.userId),
  });
  const reserve = await database.db.query.userCards.findFirst({
    where: database.eq(database.schema.userCards.id, fixture.reserveUserCardId),
  });
  expect((formation as (typeof formation & { tactic: string }) | undefined)?.tactic).toBe(
    'offensive',
  );
  expect(reserve).toMatchObject({
    holder: true,
    holderPosition: 'CA',
    favorite: true,
    captain: true,
  });
});
