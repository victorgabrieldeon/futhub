import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMissions } from '../src/modules/missions/format.js';

test('formata ciclo, progresso e recompensa da missão', () => {
  assert.equal(
    formatMissions({
      missions: [
        {
          id: 'mission-1',
          title: 'Abra packs',
          type: 'open_pack',
          cadence: 'daily',
          tier: 1,
          goal: 3,
          progress: 1,
          completed: false,
          claimed: false,
          expiresAt: '2026-08-21T00:00:00.000Z',
          reward: { itemId: 'item-1', type: 'balance', quantity: 25, resourceId: null },
        },
      ],
    }),
    '**Diária** — Abra packs: 1/3. Expira <t:1787270400:R>. Recompensa: +25 balance.',
  );
});
