import assert from 'node:assert/strict';
import test from 'node:test';

import { storeResponse } from '../src/store.js';

test('renders the packs tab as Components V2', async () => {
  const response = await storeResponse('packs', async () => [
    { id: 'pack-1', name: 'Pack Ouro', emoji: '📦', cardsAmount: 3, price: 50, limitPerUser: 2 },
  ]);

  assert.equal(response.flags, 32768);
  const container = response.components[0]?.toJSON();
  const first = container?.components[0];
  assert.ok(first && first.type === 10);
  assert.match(first.content, /Pack Ouro/);
});
