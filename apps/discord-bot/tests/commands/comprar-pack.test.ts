import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';
import { MessageFlags } from 'seyfert';

import ComprarPackCommand from '../../src/modules/store/commands/comprar-pack.js';
import { mockApi } from '../support/api.js';

test('compra pack pelo pipeline real do Seyfert', async () => {
  const api = mockApi({ quantity: 2, balance: 450 });

  await using bot = await createMockBot({ commands: [ComprarPackCommand] });

  const result = await bot.slash(ComprarPackCommand, { options: { pack_id: 'pack-1' } });

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

test('rejeita ID de pack vazio sem chamar API', async () => {
  const api = mockApi({ quantity: 2, balance: 450 });

  await using bot = await createMockBot({ commands: [ComprarPackCommand] });

  const result = await bot.slash(ComprarPackCommand, { options: { pack_id: ' ' } });

  assert.equal(result.content, 'Informe pack_id.');
  assert.deepEqual(api.requests, []);
});

test('oculta erro da API ao comprar pack', async (context) => {
  const api = mockApi({ message: 'Falha interna.' }, 503);
  context.mock.method(console, 'error', () => undefined);

  await using bot = await createMockBot({ commands: [ComprarPackCommand] });

  const result = await bot.slash(ComprarPackCommand, { options: { pack_id: 'pack-1' } });

  assert.equal(result.content, 'Não foi possível executar /comprar-pack. Tente novamente.');
  assert.equal(result.messages[0]?.flags, MessageFlags.Ephemeral);
  assert.equal(api.requests.length, 1);
});
