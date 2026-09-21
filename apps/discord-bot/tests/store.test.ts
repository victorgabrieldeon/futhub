import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialPacksState,
  packDetailResponse,
  storeResponse,
  storeSessionManager,
  toggleFavoritePack,
} from '../src/store.js';

const packId = (index: number): string =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

test('renders the packs tab as Components V2', async () => {
  const session = storeSessionManager.create('owner-1', initialPacksState());
  const response = await storeResponse(session, 'packs', async () => [
    { id: 'pack-1', name: 'Pack Ouro', emoji: '📦', cardsAmount: 3, price: 50, limitPerUser: 2 },
  ]);

  assert.equal(response.flags, 32768);
  assert.equal(response.files.length, 1);
  const image = response.files[0]?.data.resolvable;
  assert.ok(Buffer.isBuffer(image));
  assert.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const container = response.components[0]?.toJSON();
  const title = container?.components.find((component) => component.type === 10);
  assert.ok(title && title.type === 10);
  assert.equal(title.content, '# FUTHUB STORE');
  const payload = JSON.stringify(container);
  assert.match(payload, /attachment:\/\/futhub-packs\.png/);
  assert.match(payload, /Selecione um pack para ver os detalhes/);
  assert.match(payload, /"label":"Pack Ouro"/);
  assert.match(payload, /50 moedas · 3 cartas · Limite 2/);
  assert.doesNotMatch(payload, /Abra para expandir/);
});

test('paginates packs and puts session favorites first', async () => {
  const favorite = packId(6);
  const session = storeSessionManager.create(
    'owner-1',
    toggleFavoritePack(initialPacksState(), favorite),
  );
  const response = await storeResponse(session, 'packs', async () =>
    Array.from({ length: 6 }, (_, index) => ({
      id: packId(index + 1),
      name: `Pack ${index + 1}`,
      emoji: 'P',
      cardsAmount: 1,
      price: 10,
      limitPerUser: 1,
    })),
  );

  const container = response.components[0]?.toJSON();
  const payload = JSON.stringify(container);
  assert.match(payload, /Página 1 de 2/);
  assert.match(payload, /"label":"★ Pack 6"/);
  assert.doesNotMatch(payload, /Pack 5/);
  assert.match(payload, /"label":"Anterior".*"disabled":true/);
  assert.match(payload, /"label":"Próxima".*"disabled":false/);
  const customIds = Array.from(payload.matchAll(/"custom_id":"([^"]+)"/g), ([, id]) => id);
  assert.equal(new Set(customIds).size, customIds.length);
});

test('attaches pack art instead of embedding its remote URL', () => {
  const response = packDetailResponse(
    storeSessionManager.create('owner-1', initialPacksState()).id,
    {
      id: 'pack-1',
      name: 'Pack Ouro',
      price: 50,
      imageUrl: 'https://example.com/pack.png',
      cardsPerPack: 3,
    },
    'overview',
  );

  assert.equal(response.files.length, 1);
  assert.equal(response.files[0]?.data.resolvable, 'https://example.com/pack.png');
  assert.match(JSON.stringify(response.components[0]?.toJSON()), /attachment:\/\/pack-pack-1\.png/);
});
