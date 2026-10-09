import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  LucroResponse,
  MissionsResponse,
  OpenPackResponse,
  PurchaseCardResponse,
  PurchasePackResponse,
} from '@futhub/api-client';

import { botResponse } from '../src/bot-response.js';
import {
  cardPurchaseData,
  lucroData,
  missionsData,
  packOpenData,
  packPurchaseData,
} from '../src/response-data.js';
import { mockApi, withTemplates } from './support/api.js';

// Verbatim copies of the formatters the bot used before responses became editable
// (git: apps/discord-bot/src/{lucro,missions,game}.ts). Catalog defaults must match them.
const legacy = {
  truncate(message: string): string {
    return message.length <= 2_000 ? message : `${message.slice(0, 1_997)}...`;
  },
  lucro(result: LucroResponse, now: Date) {
    const render = (template: string, values: Record<string, string>) =>
      Object.entries(values).reduce(
        (message, [name, value]) => message.replaceAll(`{${name}}`, value),
        template,
      );
    const availableAt = new Date(result.availableAt);
    const available = `<t:${Math.floor(availableAt.getTime() / 1000)}:F>`;
    if (result.kind === 'cooldown') {
      const remaining = Math.max(0, Math.ceil((availableAt.getTime() - now.getTime()) / 1000));
      return { content: `Aguarde ${remaining}s. Lucro disponível em ${available}.` };
    }
    const values = {
      message: result.reward.message,
      reward: String(result.reward.value),
      balance: String(result.balance),
      xp: String(result.progression.gainedXp),
      nextLevelXp: String(result.progression.nextLevelXp),
      level: String(result.progression.level),
      availableAt: available,
    };
    const report = result.report;
    const closing = [
      '**Fechamento do clube**',
      `Bilheteria: **+${report.ticketRevenue}**`,
      `Receita comercial: **+${report.commercialRevenue}**`,
      `Patrocinador: **+${report.sponsorRevenue}**`,
      `Manutenção: **-${report.maintenance}**`,
      `Folha salarial: **-${report.payroll}**`,
      `Lucro líquido: **${report.net >= 0 ? '+' : ''}${report.net}**`,
    ].join('\n');
    return {
      embeds: [
        {
          title: render(result.embed.title, values),
          description: `${render(result.embed.description, values)}\n\n${closing}`,
          color: Number.parseInt(result.embed.color.slice(1), 16),
          footer: result.embed.footer ? { text: render(result.embed.footer, values) } : undefined,
        },
      ],
    };
  },
  missions(result: MissionsResponse): string {
    const label = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' } as const;
    if (result.missions.length === 0) return 'Nenhuma missão ativa agora.';
    const output = result.missions
      .map((mission) => {
        const status = mission.claimed
          ? 'concluída; recompensa concedida'
          : `${mission.progress}/${mission.goal}`;
        const reward = mission.reward
          ? ` Recompensa: +${mission.reward.quantity} ${mission.reward.type}.`
          : '';
        const expires = `<t:${Math.floor(new Date(mission.expiresAt).getTime() / 1000)}:R>`;
        return `**${label[mission.cadence]}** — ${mission.title}: ${status}. Expira ${expires}.${reward}`;
      })
      .join('\n');
    return output.length <= 2_000 ? output : `${output.slice(0, 1_997)}...`;
  },
  packOpen(result: OpenPackResponse): string {
    const { gainedXp, level, nextLevelXp, rewards, xp } = result.progression;
    const reward = rewards.length
      ? ` Recompensas: ${rewards.map(({ quantity, type }) => `+${quantity} ${type}`).join(', ')}.`
      : '';
    const cards = result.cards.length
      ? result.cards.map(({ card, id }) => `• \`${id}\` — OVR ${card.overall}`).join('\n')
      : 'Nenhuma carta recebida.';
    return legacy.truncate(
      `Pack aberto.\n${cards}\nXP: +${gainedXp} (${xp}/${nextLevelXp}). Nível: ${level}.${reward}`,
    );
  },
  packPurchase: (result: PurchasePackResponse) =>
    `Pack comprado. Quantidade: ${result.quantity}. Saldo: ${result.balance}.`,
  cardPurchase: (result: PurchaseCardResponse) =>
    `Carta comprada. ID no elenco: \`${result.userCardId}\`. Preço: ${result.price}. Saldo: ${result.balance}.`,
};

const identity = { userName: 'Ana', avatarUrl: '' };
const embed = {
  title: '/lucro',
  description:
    '**{message}**\nSaldo: **{balance}**\nXP: **+{xp}** ({xp}/{nextLevelXp})\nNível: **{level}**',
  color: '#2B2D31',
  footer: 'Próximo lucro: {availableAt}',
};
const progression = (rewards: { type: 'balance' | 'pack'; quantity: number }[] = []) => ({
  gainedXp: 10,
  level: 4,
  xp: 70,
  nextLevelXp: 150,
  rewards: rewards.map((reward, index) => ({ ...reward, itemId: `i${index}`, resourceId: null })),
});

test('defaults reproduce the previous /lucro embeds and cooldown text', async () => {
  mockApi(withTemplates({}));
  const now = new Date('2026-01-01T00:00:00.000Z');
  for (const report of [
    {
      ticketRevenue: 1200,
      commercialRevenue: 400,
      sponsorRevenue: 350,
      maintenance: 300,
      payroll: 300,
      net: 1350,
    },
    {
      ticketRevenue: 0,
      commercialRevenue: 0,
      sponsorRevenue: 0,
      maintenance: 900,
      payroll: 400,
      net: -1300,
    },
  ]) {
    const result: LucroResponse = {
      kind: 'success',
      reward: { value: 500, weight: 1, message: 'Lucro raro: +500' },
      report,
      balance: 4250,
      availableAt: '2026-01-01T04:00:00.000Z',
      progression: progression([{ type: 'pack', quantity: 1 }]),
      embed,
    };
    const { key, data } = lucroData(result, now);
    const message = await botResponse(key, { ...identity, ...data });
    assert.deepEqual(message.embeds, legacy.lucro(result, now).embeds);
    assert.equal(message.content, undefined);
  }
  const cooldown: LucroResponse = { kind: 'cooldown', availableAt: '2026-01-01T02:10:00.000Z' };
  const { key, data } = lucroData(cooldown, now);
  assert.equal(
    (await botResponse(key, { ...identity, ...data })).content,
    legacy.lucro(cooldown, now).content,
  );
});

test('defaults reproduce the previous /missoes text, including empty and long lists', async () => {
  mockApi(withTemplates({}));
  const mission = (index: number, claimed: boolean, reward: boolean) => ({
    id: `m${index}`,
    title: `Missão ${index} ${'x'.repeat(40)}`,
    type: 'open_pack' as const,
    cadence: (['daily', 'weekly', 'monthly'] as const)[index % 3] ?? 'daily',
    tier: 1,
    goal: 5,
    progress: index % 6,
    completed: claimed,
    claimed,
    expiresAt: '2026-01-02T00:00:00.000Z',
    reward: reward
      ? { itemId: 'i', type: 'balance' as const, quantity: 300, resourceId: null }
      : null,
  });
  for (const missions of [
    [],
    [mission(1, false, true), mission(2, true, false), mission(3, false, false)],
    Array.from({ length: 30 }, (_, i) => mission(i, i % 4 === 0, i % 2 === 0)),
  ]) {
    const result: MissionsResponse = { missions };
    const message = await botResponse('missoes.list', { ...identity, ...missionsData(result) });
    assert.equal(message.content, legacy.missions(result));
  }
});

test('defaults reproduce the previous pack and card purchase texts', async () => {
  mockApi(withTemplates({}));
  for (const rewards of [
    [],
    [
      { type: 'balance' as const, quantity: 500 },
      { type: 'pack' as const, quantity: 1 },
    ],
  ]) {
    for (const count of [0, 3]) {
      const result: OpenPackResponse = {
        cards: Array.from({ length: count }, (_, i) => ({
          id: `uc-${i}`,
          card: { id: `c-${i}`, overall: 70 + i, name: `Jogador ${i}`, position: 'CA' },
        })),
        progression: progression(rewards),
      };
      const message = await botResponse('pack.open', { ...identity, ...packOpenData('p', result) });
      assert.equal(message.content, legacy.packOpen(result));
    }
  }
  const purchase = { quantity: 2, balance: 450 };
  assert.equal(
    (await botResponse('pack.purchase', { ...identity, ...packPurchaseData('p', purchase) }))
      .content,
    legacy.packPurchase(purchase),
  );
  const card = { userCardId: 'uc-1', price: 100, balance: 350 };
  assert.equal(
    (await botResponse('card.purchase', { ...identity, ...cardPurchaseData(card) })).content,
    legacy.cardPurchase(card),
  );
});
