import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';

import ClubeCommand from '../../src/modules/team/commands/clube.js';
import { type ApiRequest, mockApi } from '../support/api.js';

const team = {
  balance: 475,
  strength: 880,
  inventoryCount: 0,
  tactic: 'balanced',
  formation: { id: 'formation-1', name: '4-3-3', slots: [] },
  formations: [{ id: 'formation-1', name: '4-3-3', slots: [] }],
  lineup: [],
  inventory: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
  packs: [],
  collections: [],
};

const club = {
  balance: 2500,
  stadium: {
    level: 2,
    maxLevel: 5,
    nextUpgradeCost: 2000,
    ticketRevenue: 400,
    maintenance: 100,
  },
  sponsor: {
    name: 'Comércio Local',
    weeklyMatches: 2,
    weeklyGoal: 3,
    payout: 300,
    completed: false,
  },
  payroll: 80,
  projectedNet: 220,
};

test('responde ao comando de prefixo !clube', async () => {
  const api = mockApi((request: ApiRequest) => (request.path === '/v1/club' ? club : team));
  await using bot = await createMockBot({ commands: [ClubeCommand], prefixes: ['!'] });

  const result = await bot.say('!clube');

  assert.match(JSON.stringify(result.messages), /MEU TIME · CLUBE/);
  assert.deepEqual(
    api.requests.map(({ method, path }) => ({ method, path })),
    [
      { method: 'POST', path: '/v1/team' },
      { method: 'POST', path: '/v1/club' },
    ],
  );
});
