import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';

import TimeCommand from '../../src/commands/time.js';
import { mockApi } from '../support/api.js';

test('vende jogadores pela aba do time', async () => {
  const api = mockApi({ userCardIds: ['card-1', 'card-2'], amount: 125, balance: 475 });

  await using bot = await createMockBot({ commands: [TimeCommand] });

  const result = await bot.slash(TimeCommand, {
    options: { aba: 'vender', ids: 'card-1, card-2' },
  });

  assert.equal(result.content, '2 carta(s) vendida(s). Recebido: 125. Saldo: 475.');
  assert.deepEqual(api.requests, [
    {
      method: 'POST',
      path: '/v1/cards/sell',
      body: {
        identity: {
          id: '900000000000000005',
          name: 'slipher-tester',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
        },
        userCardIds: ['card-1', 'card-2'],
      },
    },
  ]);
});

test('exige jogadores para vender pela aba do time', async () => {
  const api = mockApi({ userCardIds: [], amount: 0, balance: 475 });

  await using bot = await createMockBot({ commands: [TimeCommand] });

  const result = await bot.slash(TimeCommand, { options: { aba: 'vender' } });

  assert.equal(result.content, 'Informe ids.');
  assert.deepEqual(api.requests, []);
});
