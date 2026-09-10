import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { type E2eContext, adminToken, startE2eContext } from '../../../test/e2e/context.js';
import { createAdminPackFixture } from '../../../test/e2e/entities.js';
import { FilesService } from '../../files/files.service.js';

let context: E2eContext;
beforeAll(async () => {
  context = await startE2eContext();
}, 30_000);
afterAll(async () => {
  await context?.close();
});

const input = {
  name: 'Admin pack',
  imageUrl: null,
  color: '#123456',
  emoji: 'admin-pack',
  cardsAmount: 4,
  price: 20,
  canBuy: true,
  limitPerUser: 5,
  presentation: {
    schemaVersion: 1,
    color: '#123456',
    accentColor: '#f2bd54',
    textColor: '#ffffff',
    effect: 'foil',
    texture: 'aura',
    textureOpacity: 42,
    tintOpacity: 16,
    headline: '4 CARTAS',
    headlineSize: 58,
    headlineX: 300,
    headlineY: 320,
    kicker: 'EDIÇÃO PADRÃO',
    kickerX: 300,
    kickerY: 230,
  },
  config: {
    name: 'Admin filter',
    minOverall: 72,
    maxOverall: 88,
    onlyPositions: ['CA'],
    excludedPositions: [],
    onlyCollectionIds: [],
    excludedCollectionIds: [],
    onlyCardIds: [],
    excludedCardIds: [],
    onlyTeamIds: [],
    excludedTeamIds: [],
  },
};

test('creates and updates pack with config filters over HTTP', async () => {
  const created = await context.app.inject({
    method: 'POST',
    url: '/v1/admin/packs',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: input,
  });
  expect(created.statusCode).toBe(201);
  const pack = created.json();
  expect(pack.config.onlyPositions).toEqual(['CA']);
  expect(pack.presentation).toMatchObject({ effect: 'foil', headline: '4 CARTAS' });

  const updated = await context.app.inject({
    method: 'PUT',
    url: `/v1/admin/packs/${pack.id}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      ...input,
      name: 'Updated pack',
      presentation: { ...input.presentation, effect: 'chrome', headline: 'ATUALIZADO' },
      config: { ...input.config, onlyPositions: ['PE'] },
    },
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json().config.onlyPositions).toEqual(['PE']);
  expect(updated.json().presentation).toMatchObject({ effect: 'chrome', headline: 'ATUALIZADO' });
  const [persisted] = await context.database.db
    .select()
    .from(context.database.schema.packs)
    .where(context.database.eq(context.database.schema.packs.id, pack.id));
  expect(persisted?.name).toBe('Updated pack');
  const [presentation] = await context.database.db
    .select()
    .from(context.database.schema.packPresentations)
    .where(context.database.eq(context.database.schema.packPresentations.packId, pack.id));
  expect(presentation).toMatchObject({ effect: 'chrome', headline: 'ATUALIZADO' });
});

test('rejects a filter category configured to include and block over HTTP', async () => {
  const before = await context.database.db.select().from(context.database.schema.packs);
  const response = await context.app.inject({
    method: 'POST',
    url: '/v1/admin/packs',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { ...input, config: { ...input.config, excludedPositions: ['GOL'] } },
  });

  expect(response.statusCode).toBe(400);
  const after = await context.database.db.select().from(context.database.schema.packs);
  expect(after).toHaveLength(before.length);
});

test('remove disables pack and preserves possession', async () => {
  const fixture = await createAdminPackFixture(context.database);
  const response = await context.app.inject({
    method: 'DELETE',
    url: `/v1/admin/packs/${fixture.id}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().canBuy).toBe(false);
  const possessions = await context.database.db
    .select()
    .from(context.database.schema.userPacks)
    .where(context.database.eq(context.database.schema.userPacks.packId, fixture.id));
  expect(possessions).toHaveLength(1);
});

test('lists packs with locally hosted artwork over HTTP', async () => {
  const fixture = await createAdminPackFixture(context.database);
  const imageUrl = `http://localhost:9002/futhub-card-images/packs/${fixture.id}/image.png`;
  const [file] = await context.database.db
    .insert(context.database.schema.files)
    .values({
      objectKey: `packs/${fixture.id}/image.png`,
      contentType: 'image/png',
      sizeBytes: 1,
      source: 'upload',
      metadata: {},
    })
    .returning({ id: context.database.schema.files.id });
  if (!file) throw new Error('Failed to create pack image file.');
  const urls = vi
    .spyOn(FilesService.prototype, 'urls')
    .mockResolvedValue(new Map([[file.id, imageUrl]]));
  await context.database.db
    .update(context.database.schema.packs)
    .set({ imageFileId: file.id })
    .where(context.database.eq(context.database.schema.packs.id, fixture.id));
  try {
    const response = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/packs',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toContainEqual(expect.objectContaining({ id: fixture.id, imageUrl }));
    const [persisted] = await context.database.db
      .select({ imageFileId: context.database.schema.packs.imageFileId })
      .from(context.database.schema.packs)
      .where(context.database.eq(context.database.schema.packs.id, fixture.id));
    expect(persisted?.imageFileId).toBe(file.id);
  } finally {
    urls.mockRestore();
  }
});

test('uploads pack artwork over HTTP and persists its file reference', async () => {
  const fixture = await createAdminPackFixture(context.database);
  const [file] = await context.database.db
    .insert(context.database.schema.files)
    .values({
      objectKey: `packs/${fixture.id}/image.png`,
      contentType: 'image/png',
      sizeBytes: 12,
      source: 'upload',
      metadata: {},
    })
    .returning({ id: context.database.schema.files.id });
  if (!file) throw new Error('Failed to create uploaded pack file.');
  const upload = vi.spyOn(FilesService.prototype, 'upload').mockResolvedValue({
    id: file.id,
    url: `https://assets.test/packs/${fixture.id}/image.png`,
    contentType: 'image/png',
    sizeBytes: 12,
    width: null,
    height: null,
  });
  const urls = vi
    .spyOn(FilesService.prototype, 'urls')
    .mockResolvedValue(new Map([[file.id, `https://assets.test/packs/${fixture.id}/image.png`]]));
  try {
    const response = await imageRequest(fixture.id, Buffer.from('pack-artwork'));
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/png', extension: 'png' }),
    );
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().imageUrl).toBe(`https://assets.test/packs/${fixture.id}/image.png`);
    const [persisted] = await context.database.db
      .select({ imageFileId: context.database.schema.packs.imageFileId })
      .from(context.database.schema.packs)
      .where(context.database.eq(context.database.schema.packs.id, fixture.id));
    expect(persisted?.imageFileId).toBe(file.id);
  } finally {
    upload.mockRestore();
    urls.mockRestore();
  }
});

function imageRequest(id: string, image: Buffer) {
  const boundary = '----futhub-pack-image';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="pack.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    image,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return context.app.inject({
    method: 'PUT',
    url: `/v1/admin/packs/${id}/image`,
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
}
