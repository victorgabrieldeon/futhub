import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';

import StatusApiCommand from '../../src/commands/status-api.js';
import { mockApi } from '../support/api.js';

test('informa API online pelo pipeline real do Seyfert', async () => {
  const api = mockApi({ status: 'ok' });

  await using bot = await createMockBot({ commands: [StatusApiCommand] });

  const result = await bot.slash(StatusApiCommand);

  assert.equal(result.content, 'API online.');
  assert.deepEqual(api.requests, [{ method: 'GET', path: '/health', body: null }]);
});

test('informa API indisponível para status diferente de ok', async () => {
  mockApi({ status: 'degraded' });

  await using bot = await createMockBot({ commands: [StatusApiCommand] });

  const result = await bot.slash(StatusApiCommand);

  assert.equal(result.content, 'API indisponível.');
});
