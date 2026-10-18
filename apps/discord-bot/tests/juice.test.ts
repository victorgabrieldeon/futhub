import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';
import { MessageFlags } from 'seyfert';

import LucroCommand from '../src/commands/lucro.js';
import type { BotMessage } from '../src/core/bot-response.js';
import { countUp, juice, leveledUp, rarity, scene } from '../src/core/juice.js';
import { type TestMatch, matchFrames, testMatchResponse } from '../src/features/test-match.js';
import { messageText, mockApi, withTemplates } from './support/api.js';

juice.frameDelayMs = 0;

const lucro = (progression: Record<string, unknown>) => ({
  kind: 'success',
  reward: { value: 500, weight: 1, message: 'Lucro raro!' },
  report: {
    ticketRevenue: 400,
    commercialRevenue: 100,
    sponsorRevenue: 50,
    maintenance: 30,
    payroll: 20,
    net: 500,
  },
  balance: 4_750,
  availableAt: '2030-01-01T00:00:00.000Z',
  progression: { gainedXp: 10, level: 3, xp: 50, nextLevelXp: 250, rewards: [], ...progression },
  embed: { title: '', description: '', color: '#000000', footer: '' },
  completedMissions: [],
});

test('raridade escala com o overall', () => {
  assert.deepEqual(
    [70, 75, 80, 85, 90, 95].map((overall) => rarity(overall).label),
    ['Comum', 'Incomum', 'Rara', 'Épica', 'Lendária', 'Ícone'],
  );
  assert.ok(rarity(96).rank > rarity(84).rank);
});

test('contador sobe rápido e assenta no valor exato', () => {
  assert.deepEqual(countUp(500, 3), [352, 481, 500]);
  assert.deepEqual(countUp(1, 1), [1]);
});

test('subida de nível é detectada quando a barra vira', () => {
  assert.equal(leveledUp({ gainedXp: 30, xp: 10, level: 4, nextLevelXp: 300, rewards: [] }), true);
  assert.equal(leveledUp({ gainedXp: 10, xp: 50, level: 3, nextLevelXp: 250, rewards: [] }), false);
});

test('lucro conta o valor em quadros e termina no template', async () => {
  mockApi(withTemplates(lucro({})));
  await using bot = await createMockBot({ commands: [LucroCommand] });

  const result = await bot.slash(LucroCommand);
  const files = result.messages.map(
    (message) => (message as { files?: { filename?: string }[] }).files?.[0]?.filename,
  );

  // Dois quadros do contador (só imagem) e o resultado com a imagem do fechamento.
  assert.deepEqual(files, ['lucro-0.png', 'lucro-1.png', 'lucro.png']);
  assert.match(messageText(result.messages.at(-1)), /LUCRO DE SLIPHER-TESTER\n# 🪙 \+500/);
  assert.match(JSON.stringify(result.messages[0]), /\+352 moedas/);
});

test('subir de nível ganha um quadro próprio com as recompensas', async () => {
  mockApi(
    withTemplates(
      lucro({
        gainedXp: 30,
        xp: 10,
        level: 4,
        rewards: [{ itemId: 'i', type: 'balance', quantity: 1_000, resourceId: null }],
      }),
    ),
  );
  await using bot = await createMockBot({ commands: [LucroCommand] });

  const result = await bot.slash(LucroCommand);

  assert.ok(result.messages.some((message) => /Subiu para o nível 4!/.test(messageText(message))));
});

test('sem animações, a cena manda só o resultado', async () => {
  const sent: string[] = [];
  const message = (content: string) => ({ flags: 32768, content }) as unknown as BotMessage;
  const stage = {
    reply: async (value: BotMessage) => void sent.push(`reply:${String(value.content)}`),
    edit: async (value: BotMessage) => void sent.push(`edit:${String(value.content)}`),
    remove: async () => void sent.push('remove'),
    followup: async (value: BotMessage) => void sent.push(`followup:${String(value.content)}`),
  };
  juice.enabled = false;
  try {
    const show = scene(stage, { ephemeral: true });
    await show.frame(message('quadro'));
    await show.finish(message('final'));
  } finally {
    juice.enabled = true;
  }
  assert.deepEqual(sent, ['reply:final']);

  sent.length = 0;
  const legacy = { content: 'legado' } as BotMessage;
  const show = scene(stage, { ephemeral: true });
  await show.frame(message('quadro'));
  await show.finish(legacy);
  // Um quadro V2 não vira texto: a cena apaga e manda o resultado de novo, ainda privado.
  assert.deepEqual(sent, ['reply:quadro', 'remove', 'followup:legado']);
});

test('quadros de cena privada saem privados', async () => {
  const flags: number[] = [];
  const stage = {
    reply: async (value: BotMessage) => void flags.push(value.flags ?? 0),
    edit: async (value: BotMessage) => void flags.push(value.flags ?? 0),
    remove: async () => undefined,
    followup: async () => undefined,
  };
  const show = scene(stage, { ephemeral: true });
  await show.frame({ flags: 32768 } as BotMessage);
  await show.finish({ flags: 32768 | MessageFlags.Ephemeral } as BotMessage);
  assert.deepEqual(flags, [32768 | MessageFlags.Ephemeral, 32768]);
});

test('gol vira destaque dourado e segura mais na tela', async () => {
  const event = (type: string, homeGoals: number, minute: number) => ({
    minute,
    type,
    description: type,
    homeGoals,
    awayGoals: 0,
  });
  const match = {
    seed: 1,
    home: {
      name: 'Casa',
      avatarUrl: null,
      cpu: false,
      tactic: 'balanced',
      rating: 80,
      lineup: [],
      slots: [],
    },
    away: {
      name: 'Fora',
      avatarUrl: null,
      cpu: true,
      tactic: 'balanced',
      rating: 80,
      lineup: [],
      slots: [],
    },
    homeGoals: 1,
    awayGoals: 0,
    events: [event('kickoff', 0, 0), event('goal', 1, 30), event('fulltime', 1, 90)],
  } as unknown as TestMatch;

  const frame = await testMatchResponse(match, { revealed: 2 });
  const goal = JSON.stringify(frame.components[0]?.toJSON());
  assert.match(goal, /attachment:\/\/partida-2\.png/);
  assert.match(goal, /"accent_color":14919471/);
  assert.match(JSON.stringify(frame.files[0]), /partida-2\.png/);
  // Tensão antes do gol, intervalo na virada dos 45' e o gol segurando mais na tela.
  assert.deepEqual(matchFrames(match), [
    { revealed: 1, hold: 1 },
    { revealed: 1, beat: 'chance', hold: 0.8 },
    { revealed: 2, hold: 2 },
    { revealed: 2, beat: 'halftime', hold: 1.5 },
    { revealed: 3, hold: 1.5 },
  ]);
  const chance = JSON.stringify(
    (await testMatchResponse(match, { revealed: 1, beat: 'chance' })).components[0]?.toJSON(),
  );
  assert.match(chance, /AO VIVO · 30'/);
  assert.match(chance, /Casa chega com perigo/);
  assert.match(chance, /Casa 0 × 0 Fora/);
  const end = JSON.stringify(
    (await testMatchResponse(match, { revealed: 3 })).components[0]?.toJSON(),
  );
  assert.match(end, /Vitória/);
  assert.match(end, /Intervalo · 1 × 0/);
});
