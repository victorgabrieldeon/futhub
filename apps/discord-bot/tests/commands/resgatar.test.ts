import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';
import { MessageFlags } from 'seyfert';

import ResgatarCommand from '../../src/commands/resgatar.js';
import { mockApi, withTemplates } from '../support/api.js';

const reward = {
  itemId: '7b1a2b3c-0000-4000-8000-000000000001',
  resourceId: null,
  resourceName: null,
};

test('resgata código pelo pipeline real do Seyfert', async () => {
  const api = mockApi(
    withTemplates({
      kind: 'success',
      code: 'BEMVINDO',
      reward: { ...reward, type: 'balance', quantity: 500 },
      balance: 1500,
    }),
  );

  await using bot = await createMockBot({ commands: [ResgatarCommand] });

  const result = await bot.slash(ResgatarCommand, { options: { codigo: 'bemvindo' } });

  assert.equal(
    result.content,
    '🎁 Código **BEMVINDO** resgatado! Você recebeu +500 moedas. 🪙 Saldo: 1500.',
  );
  assert.equal(result.messages[0]?.flags, MessageFlags.Ephemeral);
  assert.deepEqual(api.requests, [
    {
      method: 'POST',
      path: '/v1/commands/resgatar',
      body: {
        identity: {
          id: '900000000000000005',
          name: 'slipher-tester',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
        },
        code: 'bemvindo',
      },
    },
    { method: 'GET', path: '/v1/bot-responses/resgatar.success', body: null },
  ]);
});

test('descreve cartas e packs recebidos pelo nome', async () => {
  mockApi(
    withTemplates({
      kind: 'success',
      code: 'CRAQUE',
      reward: { ...reward, type: 'card', quantity: 2, resourceName: 'Rafael Lima' },
      balance: 0,
    }),
  );

  await using bot = await createMockBot({ commands: [ResgatarCommand] });

  const result = await bot.slash(ResgatarCommand, { options: { codigo: 'craque' } });

  assert.equal(
    result.content,
    '🎁 Código **CRAQUE** resgatado! Você recebeu 2× carta **Rafael Lima**. 🪙 Saldo: 0.',
  );
});

test('explica por que o resgate foi recusado', async () => {
  const api = mockApi(withTemplates({ kind: 'rejected', reason: 'already_redeemed' }));

  await using bot = await createMockBot({ commands: [ResgatarCommand] });

  const result = await bot.slash(ResgatarCommand, { options: { codigo: 'bemvindo' } });

  assert.equal(result.content, '❌ Você já resgatou este código.');
  assert.equal(result.messages[0]?.flags, MessageFlags.Ephemeral);
  assert.deepEqual(api.requests.at(-1), {
    method: 'GET',
    path: '/v1/bot-responses/resgatar.rejected',
    body: null,
  });
});

test('rejeita código vazio sem chamar API', async () => {
  const api = mockApi({});

  await using bot = await createMockBot({ commands: [ResgatarCommand] });

  const result = await bot.slash(ResgatarCommand, { options: { codigo: '  ' } });

  assert.equal(result.content, 'Informe o código.');
  assert.deepEqual(api.requests, []);
});
