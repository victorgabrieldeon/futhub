import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';

import StatusApiCommand from '../../src/commands/status-api.js';
import { EMOJI } from '../../src/core/emojis.js';
import { messageText, mockApi } from '../support/api.js';

test('informa API online pelo pipeline real do Seyfert', async () => {
  const api = mockApi({ status: 'ok' });

  await using bot = await createMockBot({ commands: [StatusApiCommand] });

  const result = await bot.slash(StatusApiCommand);

  assert.match(messageText(result.messages[0]), new RegExp(`${EMOJI.sucesso} Servidor online`));
  assert.deepEqual(api.requests, [{ method: 'GET', path: '/health', body: null }]);
});

test('informa API indisponível para status diferente de ok', async () => {
  mockApi({ status: 'degraded' });

  await using bot = await createMockBot({ commands: [StatusApiCommand] });

  const result = await bot.slash(StatusApiCommand);

  assert.match(messageText(result.messages[0]), new RegExp(`${EMOJI.erro} Servidor indisponível`));
});
