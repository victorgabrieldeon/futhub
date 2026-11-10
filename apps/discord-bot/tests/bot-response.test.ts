import assert from 'node:assert/strict';
import test from 'node:test';

import { definition, imagePresets, imageRef } from '@futhub/bot-templates';

import { botResponse } from '../src/core/bot-response.js';
import { lucroData, missionsData, packOpenData } from '../src/core/response-data.js';
import { messageText, mockApi, withTemplates } from './support/api.js';

const pack = { name: 'Pack Ouro', emoji: '📦' };
const opened = {
  cards: [
    {
      id: 'uc-1',
      card: {
        id: 'c-1',
        overall: 88,
        name: 'Rafael Lima',
        position: 'CA',
        imageUrl: null,
        team: { name: 'Flamengo', emoji: '<:tm_flamengo_ab12cd:300000000000000001>' },
        collection: { name: 'Lendas', emoji: '🏆' },
      },
    },
    {
      id: 'uc-2',
      card: {
        id: 'c-2',
        overall: 79,
        name: 'Bruno Costa',
        position: 'MC',
        imageUrl: null,
        // Times importados guardam siglas no campo emoji; elas não aparecem como ícone.
        team: { name: 'Barcelona', emoji: 'FCB' },
        collection: { name: 'Padrão', emoji: '🎴' },
      },
    },
  ],
  progression: {
    gainedXp: 10,
    level: 3,
    xp: 40,
    nextLevelXp: 100,
    rewards: [{ itemId: 'i', type: 'balance' as const, quantity: 500, resourceId: null }],
  },
  completedMissions: [],
};

test('pack aberto padrão lista as cartas da melhor para a pior, com as recompensas de nível', async () => {
  mockApi(withTemplates({}));
  const message = await botResponse('pack.open', {
    userName: 'Ana',
    ...packOpenData('p-1', pack, { ...opened, cards: [...opened.cards].reverse() }),
  });
  assert.equal(message.flags, 32768);
  const text = messageText(message);
  assert.match(text, /-# 🎉 PACK ABERTO\n## 📦 Pack Ouro\n-# 2 novas no elenco de Ana/);
  assert.match(
    text,
    /🟣 \*\*88\*\* · Rafael Lima · `CA` · <:tm_flamengo_ab12cd:300000000000000001> Flamengo\n🟢 \*\*79\*\* · Bruno Costa · `MC` · {2}Barcelona/,
  );
  assert.match(
    text,
    /\*\*\+10 XP\*\*.*Nível \*\*3\*\* \(40\/100\)\n🎁 \*\*Subiu de nível!\*\* \+500 moedas/,
  );
});

test('imagem gerada no painel vira anexo PNG desenhado pelo bot', async () => {
  const entry = definition('pack.open');
  const preset = entry && imagePresets(entry).find((item) => item.id === 'cards-grid');
  assert.ok(preset);
  mockApi(
    withTemplates(
      {},
      {
        'pack.open': {
          mode: 'components_v2',
          content: '',
          embeds: [],
          lists: [
            {
              source: 'cards',
              item: '**{name}** · {overall}',
              separator: ' | ',
              empty: '',
              limit: 5,
              more: '',
            },
          ],
          images: [preset.image],
          components: [
            {
              type: 'container',
              color: '#D9A21B',
              components: [
                { type: 'text', content: '{cards|count} cartas: {cards}' },
                { type: 'media', url: imageRef(preset.image.id), description: '' },
              ],
            },
          ],
        },
      },
    ),
  );
  const message = await botResponse('pack.open', packOpenData('p-1', pack, opened));
  assert.equal(message.flags, 32768);
  const container = (
    message.components as unknown as {
      components: { content?: string; items?: { media: { url: string } }[] }[];
    }[]
  )[0];
  assert.equal(
    container?.components[0]?.content,
    '2 cartas: **Rafael Lima** · 88 | **Bruno Costa** · 79',
  );
  assert.equal(container?.components[1]?.items?.[0]?.media.url, 'attachment://cartas.png');
  const file = (message.files as { filename: string; data: Buffer }[])[0];
  assert.equal(file?.filename, 'cartas.png');
  assert.deepEqual([...(file?.data.subarray(1, 4) ?? [])], [...Buffer.from('PNG')]);
});

test('template salvo inválido cai no padrão do catálogo', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  mockApi(
    withTemplates(
      {},
      { 'pack.open': { mode: 'components_v2', content: '', embeds: [], components: [] } },
    ),
  );
  const message = await botResponse('pack.open', packOpenData('p-1', pack, opened));
  assert.match(messageText(message), /Pack Ouro/);
});

test('lucro e missões viram variáveis e listas do catálogo', () => {
  const { key, data } = lucroData(
    {
      kind: 'success',
      reward: { value: 500, weight: 1, message: 'Lucro raro' },
      report: {
        ticketRevenue: 1200,
        commercialRevenue: 400,
        sponsorRevenue: 350,
        maintenance: 300,
        payroll: 300,
        net: 1350,
      },
      balance: 4250,
      availableAt: '2026-01-01T00:00:00.000Z',
      progression: { gainedXp: 10, level: 2, xp: 30, nextLevelXp: 100, rewards: [] },
      embed: { title: '', description: '', color: '#000000', footer: '' },
      completedMissions: [],
    },
    new Date('2025-12-31T23:00:00.000Z'),
  );
  assert.equal(key, 'lucro.success');
  assert.equal(data.availableAt, '<t:1767225600:F>');
  assert.equal(data.availableIn, '<t:1767225600:R>');
  assert.deepEqual((data.report as Record<string, string>[]).slice(-2), [
    { label: 'Folha salarial', value: '-300', amount: '300' },
    { label: 'Lucro líquido', value: '+1350', amount: '1350' },
  ]);
  const missions = missionsData({
    missions: [
      {
        id: 'm',
        title: 'Abra packs',
        type: 'open_pack',
        cadence: 'weekly',
        tier: 1,
        goal: 4,
        progress: 1,
        completed: false,
        claimed: false,
        expiresAt: '2026-01-01T00:00:00.000Z',
        reward: null,
      },
    ],
  });
  assert.deepEqual((missions.missions as Record<string, string>[])[0], {
    title: 'Abra packs',
    cadence: 'Semanal',
    progress: '1',
    goal: '4',
    percent: '25',
    bar: '▰▰▰▱▱▱▱▱▱▱',
    status: '1/4',
    expires: '<t:1767225600:R>',
    reward: 'Sem recompensa',
    done: '🎯',
  });
});
