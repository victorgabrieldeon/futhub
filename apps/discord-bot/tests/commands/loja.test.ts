import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';

import LojaCommand from '../../src/commands/loja.js';
import { mockApi } from '../support/api.js';

test('lista packs pela aba da loja', async () => {
  const api = mockApi([
    {
      id: 'pack-1',
      name: 'Pack Ouro',
      emoji: '📦',
      cardsAmount: 3,
      price: 50,
      limitPerUser: 2,
    },
  ]);

  await using bot = await createMockBot({ commands: [LojaCommand] });

  const result = await bot.slash(LojaCommand, { options: { aba: 'packs' } });

  assert.match(result.content ?? '', /Pack Ouro/);
  assert.deepEqual(api.requests, [{ method: 'GET', path: '/v1/packs', body: null }]);
});

test('compra pack pela aba da loja', async () => {
  const api = mockApi({ quantity: 2, balance: 450 });

  await using bot = await createMockBot({ commands: [LojaCommand] });

  const result = await bot.slash(LojaCommand, {
    options: { aba: 'packs', pack_id: 'pack-1' },
  });

  assert.equal(result.content, 'Pack comprado. Quantidade: 2. Saldo: 450.');
  assert.deepEqual(api.requests, [
    {
      method: 'POST',
      path: '/v1/packs/pack-1/purchase',
      body: {
        identity: {
          id: '900000000000000005',
          name: 'slipher-tester',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
        },
      },
    },
  ]);
});

test('contrata carta pela aba da loja', async () => {
  const api = mockApi({ userCardId: 'user-card-1', price: 100, balance: 350 });

  await using bot = await createMockBot({ commands: [LojaCommand] });

  const result = await bot.slash(LojaCommand, {
    options: { aba: 'contratar', carta_id: 'card-1' },
  });

  assert.equal(
    result.content,
    'Carta comprada. ID no elenco: `user-card-1`. Preço: 100. Saldo: 350.',
  );
  assert.deepEqual(api.requests, [
    {
      method: 'POST',
      path: '/v1/cards/card-1/purchase',
      body: {
        identity: {
          id: '900000000000000005',
          name: 'slipher-tester',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
        },
      },
    },
  ]);
});

test('exige ID para contratar pela loja', async () => {
  const api = mockApi({ userCardId: 'user-card-1', price: 100, balance: 350 });

  await using bot = await createMockBot({ commands: [LojaCommand] });

  const result = await bot.slash(LojaCommand, { options: { aba: 'contratar' } });

  assert.equal(result.content, 'Informe carta_id.');
  assert.deepEqual(api.requests, []);
});
