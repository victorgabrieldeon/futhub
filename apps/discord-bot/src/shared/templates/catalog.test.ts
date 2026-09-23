import assert from 'node:assert/strict';
import test from 'node:test';
import type { BotResponseDefinitionDto } from '@futhub/api-client';
import { type Action, renderResponse } from './responses.js';
import { createRuntime } from './runtime.js';

test('backend catalog defaults and every runtime context agree on keys and variables', async () => {
  // Dynamic URL keeps server sources out of the bot build; catalog has only type imports.
  const catalogUrl = new URL(
    '../../../../api/src/modules/bot-responses/bot-responses.catalog.ts',
    import.meta.url,
  );
  const { botResponseCatalog: catalog } = (await import(catalogUrl.href)) as {
    botResponseCatalog: BotResponseDefinitionDto[];
  };
  const binding = { userId: '123', packId: '12345678-1234-1234-1234-123456789abc', page: 1 };
  for (const definition of catalog) {
    const values = Object.fromEntries(
      definition.variables.map(({ token, example }) => [token.slice(1, -1), example]),
    );
    assert.doesNotThrow(
      () => renderResponse(definition.defaultTemplate, values, binding),
      definition.key,
    );
  }
  const keys: string[] = [];
  const visited = new Set<string>();
  let cooldown = false;
  const progression = { gainedXp: 5, xp: 15, level: 1, nextLevelXp: 100, rewards: [] };
  const pack = { id: binding.packId, name: 'Pack', price: 10, imageUrl: '', cardsPerPack: 1 };
  const client = {
    getBotResponse: async (key: string) => {
      keys.push(key);
      const definition = catalog.find((entry) => entry.key === key);
      assert.ok(definition, `Unknown runtime catalog key: ${key}`);
      return {
        ...definition.defaultTemplate,
        content: definition.variables.map(({ token }) => token).join(' | '),
      };
    },
    executeLucro: async () =>
      cooldown
        ? { kind: 'cooldown', availableAt: '2026-08-15T12:01:00Z' }
        : {
            kind: 'success',
            availableAt: '2026-08-15T12:01:00Z',
            reward: { value: 10, message: 'Reward' },
            balance: 20,
            progression,
          },
    getPackShop: async (query: { page: number }) => {
      assert.deepEqual(query, { page: 1 });
      return { packs: [pack], page: 1, totalPages: 1 };
    },
    inspectPack: async (id: string) => {
      assert.equal(id, pack.id);
      return pack;
    },
    purchasePack: async () => ({ balance: 10, quantity: 1 }),
    openPack: async () => ({ cards: [], progression }),
  } as unknown as Parameters<typeof createRuntime>[0];
  const runtime = createRuntime(client);
  const identity = { id: '123', name: 'Current context user', avatarUrl: null };
  for (const [action, key] of [
    ['lucro.claim', 'lucro.success'],
    ['lucro.claim', 'lucro.cooldown'],
    ['pack.shop', 'pack.shop'],
    ['pack.inspect', 'pack.inspect'],
    ['pack.purchase', 'pack.purchase'],
    ['pack.open', 'pack.open'],
  ] as [Action, string][]) {
    cooldown = key === 'lucro.cooldown';
    keys.length = 0;
    const result = await runtime.execute(
      action,
      identity,
      binding,
      new Date('2026-08-15T12:00:00Z'),
    );
    assert.deepEqual(keys, action === 'lucro.claim' ? ['lucro.success', 'lucro.cooldown'] : [key]);
    assert.ok(result.message.content?.includes(identity.name), `${key} fell back or lost userName`);
    visited.add(key);
  }
  keys.length = 0;
  const error = await runtime.error(identity.name, identity.id, 'pack.purchase');
  assert.deepEqual(keys, ['pack.error']);
  assert.ok(error.content?.includes(identity.name));
  visited.add('pack.error');
  assert.deepEqual([...visited].sort(), catalog.map(({ key }) => key).sort());
});
