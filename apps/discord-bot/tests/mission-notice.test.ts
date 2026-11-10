import assert from 'node:assert/strict';
import test from 'node:test';

import type { CompletedMissionDto } from '@futhub/api-client';

import { missionNotice, sendMissionNotice } from '../src/core/mission-notice.js';
import { messageText, mockApi, withTemplates } from './support/api.js';

const identity = { name: 'Victor', avatarUrl: null };
const missions: CompletedMissionDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Resgate o lucro',
    cadence: 'daily',
    reward: {
      itemId: '00000000-0000-4000-8000-000000000002',
      type: 'balance',
      quantity: 300,
      resourceId: null,
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    title: 'Abra 5 packs',
    cadence: 'weekly',
    reward: {
      itemId: '00000000-0000-4000-8000-000000000004',
      type: 'pack',
      quantity: 1,
      resourceId: '00000000-0000-4000-8000-000000000005',
    },
  },
];

test('anuncia missões concluídas com ciclo e recompensa', async () => {
  mockApi(withTemplates({}));

  const notice = await missionNotice(identity, missions);

  assert.equal(
    messageText(notice ?? undefined),
    '-# 🎉 🎉 🎉\n## 🏆 Missão concluída!\n✅ **Resgate o lucro** · Diária — **+300 moedas**\n✅ **Abra 5 packs** · Semanal — **+1 pack**',
  );
});

test('não envia aviso quando nenhuma missão foi concluída', async () => {
  const api = mockApi(withTemplates({}));
  const sent: unknown[] = [];

  await sendMissionNotice(async (message) => sent.push(message), identity, []);

  assert.deepEqual(sent, []);
  assert.deepEqual(api.requests, []);
});

test('falha no aviso não propaga para a ação já concluída', async () => {
  mockApi(withTemplates({}));

  await assert.doesNotReject(
    sendMissionNotice(
      async () => {
        throw new Error('Discord indisponível');
      },
      identity,
      missions,
    ),
  );
});
