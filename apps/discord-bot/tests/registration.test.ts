import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createMockBot } from '@slipher/testing';

import { mockApi } from './support/api.js';

test('Seyfert discovers feature commands and components through its loader directories', async () => {
  mockApi({ status: 'ok' });
  await using bot = await createMockBot({
    commandsDir: fileURLToPath(new URL('../src/commands/', import.meta.url)),
    componentsDir: fileURLToPath(new URL('../src/components/', import.meta.url)),
    loadModule: (path) => import(path),
  });

  assert.equal(bot.registeredCommands().length, 8);
  assert.deepEqual(
    bot.client.components?.commands.map((component) => component.constructor.name).sort(),
    [
      'LojaPackSelectComponent',
      'LojaTabComponent',
      'TimeButtonComponent',
      'TimeSearchComponent',
      'TimeSelectComponent',
    ],
  );
  const status = await bot.slash({ name: 'status-api' });
  assert.equal(status.content, 'API online.');
});
