import assert from 'node:assert/strict';
import test from 'node:test';

import { apiMessage, buttonInteraction, createMockBot } from '@slipher/testing';
import { MessageFlags } from 'seyfert';

import AbrirPackCommand from '../../src/commands/abrir-pack.js';
import AjudaCommand from '../../src/commands/ajuda.js';
import LucroCommand from '../../src/commands/lucro.js';
import TimeCommand from '../../src/commands/time.js';
import NavButtonComponent from '../../src/components/nav-button.js';
import { juice } from '../../src/core/juice.js';
import { navId, parseNavId } from '../../src/core/nav.js';
import { type HubData, nextStep } from '../../src/features/team/hub.js';
import type { TeamResponse } from '../../src/features/team/team-session.js';
import {
  type ApiRequest,
  messageButtons,
  messageText,
  mockApi,
  withTemplates,
} from '../support/api.js';

juice.frameDelayMs = 0;

/** A peça principal da mensagem é um PNG gerado pelo bot. */
function assertPicture(message: unknown, name?: string): void {
  const files = (message as { files?: { filename?: string; name?: string; data?: unknown }[] })
    ?.files;
  const file = files?.[0];
  assert.ok(file, 'mensagem sem imagem');
  const filename = file.filename ?? file.name;
  if (name) assert.equal(filename, name);
  assert.match(JSON.stringify(message), new RegExp(`attachment://${filename}`));
}

const owner = '900000000000000005';
const stranger = '900000000000000006';
const packId = '00000000-0000-4000-8000-0000000000aa';

const slots = ['GOL', 'LD', 'ZAG', 'ZAG', 'LE', 'VOL', 'MC', 'MA', 'PD', 'CA', 'PE'].map(
  (position, index) => ({ id: `s${index}`, position, x: 0, y: 0 }),
);

const team = {
  balance: 4_750,
  strength: 880,
  inventoryCount: 23,
  tactic: 'balanced',
  formation: { id: 'f-1', name: '4-3-3', slots },
  formations: [],
  lineup: [],
  inventory: { items: [], total: 23, page: 1, pageSize: 10, totalPages: 3 },
  packs: [{ id: packId, name: 'Pack Ouro', emoji: '📦', quantity: 2 }],
  collections: [],
  profile: { level: 3, xp: 40, nextLevelXp: 250 },
  profit: { availableAt: null },
} as unknown as TeamResponse;

const league = {
  points: 120,
  wins: 4,
  draws: 1,
  losses: 2,
  division: {
    id: 'd',
    name: 'Bronze',
    minimumPoints: 0,
    emoji: '🥉',
    color: '#cd7f32',
    imageUrl: null,
  },
  queue: null,
};

const missions = {
  missions: [
    {
      id: 'm-1',
      title: 'Abra 3 packs',
      type: 'open_pack',
      cadence: 'daily',
      tier: 1,
      goal: 3,
      progress: 2,
      completed: false,
      claimed: false,
      expiresAt: '2030-01-01T00:00:00.000Z',
      reward: { itemId: 'i', type: 'balance', quantity: 300, resourceId: null },
    },
    {
      id: 'm-2',
      title: 'Resgate o lucro',
      type: 'claim_lucro',
      cadence: 'daily',
      tier: 1,
      goal: 1,
      progress: 1,
      completed: true,
      claimed: true,
      expiresAt: '2030-01-01T00:00:00.000Z',
      reward: null,
    },
  ],
};

const opened = {
  cards: [
    {
      id: 'uc-1',
      card: {
        id: 'c-1',
        overall: 79,
        name: 'Bruno Costa',
        position: 'MC',
        imageUrl: null,
        team: { name: 'Flamengo', emoji: '🔴' },
        collection: { name: 'Lendas', emoji: '🏆' },
      },
    },
    {
      id: 'uc-2',
      card: {
        id: 'c-2',
        overall: 91,
        name: 'Rafael Lima',
        position: 'CA',
        imageUrl: null,
        team: { name: 'Flamengo', emoji: '🔴' },
        collection: { name: 'Lendas', emoji: '🏆' },
      },
    },
  ],
  progression: { gainedXp: 10, level: 3, xp: 50, nextLevelXp: 250, rewards: [] },
  completedMissions: [],
};

function game(overrides: Record<string, unknown> = {}) {
  const templates = withTemplates({});
  return (request: ApiRequest) => {
    if (request.path in overrides) return overrides[request.path];
    if (request.path === '/v1/team') return team;
    if (request.path === '/v1/league') return league;
    if (request.path === '/v1/missions') return missions;
    if (request.path === `/v1/packs/${packId}/open`) return opened;
    if (request.path === '/v1/packs') return [];
    return templates(request);
  };
}

function hubData(changes: Partial<TeamResponse> = {}, queue: unknown = null): HubData {
  return {
    identity: { id: owner, name: 'ana', avatarUrl: null },
    team: { ...team, ...changes },
    league: { status: { ...league, queue }, match: null } as unknown as HubData['league'],
    missions: null,
  };
}

test('próximo passo prioriza lucro, packs, escalação e liga nessa ordem', () => {
  assert.equal(nextStep(hubData()).target, 'lucro');
  const waiting = { availableAt: '2030-01-01T00:00:00.000Z' };
  assert.equal(nextStep(hubData({ profit: waiting })).target, 'packs');
  assert.deepEqual(nextStep(hubData({ profit: waiting, packs: [] })), {
    target: 'time',
    message: 'Monte sua escalação na aba **Escalação**.',
  });
  const full = team.formation.slots.map(() => team.inventory.items[0]) as TeamResponse['lineup'];
  assert.equal(nextStep(hubData({ profit: waiting, packs: [], lineup: full })).target, 'liga');
  assert.equal(
    nextStep(hubData({ profit: waiting, packs: [], lineup: full }, { kind: 'waiting' })).target,
    'loja',
  );
});

test('/time abre no início com o clube inteiro, atalhos e o próximo passo', async () => {
  const api = mockApi(game());
  await using bot = await createMockBot({ commands: [TimeCommand] });

  const result = await bot.slash(TimeCommand);
  const text = messageText(result.messages[0]);

  assert.equal(result.messages[0]?.flags, 32768 | MessageFlags.Ephemeral);
  // O painel é a imagem; o texto fica só com o próximo passo.
  assertPicture(result.messages[0], 'inicio.png');
  assert.match(
    JSON.stringify(result.messages[0]),
    /Clube de slipher-tester: nível 3, 4\.750 moedas/,
  );
  assert.equal(text, '> **Próximo passo:** Seu lucro está pronto.');
  const buttons = messageButtons(result.messages[0]);
  const lucro = buttons.find(({ label }) => label === 'Resgatar lucro');
  assert.equal(lucro?.style, 3);
  assert.equal(parseNavId(lucro?.customId ?? '')?.ownerId, owner);
  assert.ok(buttons.some(({ label }) => label === 'Abrir packs (2)'));
  assert.deepEqual(
    api.requests.map(({ path }) => path),
    ['/v1/team', '/v1/league', '/v1/missions'],
  );
});

test('o início abre mesmo sem liga e missões', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  mockApi((request: ApiRequest) => {
    if (request.path === '/v1/team') return team;
    throw new Error('offline');
  });
  await using bot = await createMockBot({ commands: [TimeCommand] });

  const result = await bot.slash(TimeCommand);

  assertPicture(result.messages[0], 'inicio.png');
  assert.match(messageText(result.messages[0]), /Próximo passo/);
});

test('atalho do dono troca a tela V2 no lugar; legado ou outro jogador abre em privado', async () => {
  mockApi(game());
  await using bot = await createMockBot({ components: [NavButtonComponent] });
  const own = await bot.dispatchInteraction(
    buttonInteraction({
      customId: navId('missoes', owner),
      user: bot.defaultUser,
      message: apiMessage({ flags: MessageFlags.IsComponentsV2 }),
    }),
  );
  assert.equal(own.deferredUpdate, true);
  assert.equal(own.ephemeral, false);
  assert.match(messageText(own.edits[0]), /## 🎯 Missões\n-# 2 ativas para slipher-tester/);
  assert.match(messageText(own.edits[0]), /`▰▰▰▰▰▰▰▱▱▱` \*\*2\/3\*\* · Diária/);
  assert.match(messageText(own.edits[0]), /Recompensa: \+300 moedas/);

  // Mensagem com embeds não vira Components V2: o Discord recusa a edição.
  bot.reset();
  const legacy = await bot.dispatchInteraction(
    buttonInteraction({
      customId: navId('hub', owner),
      user: bot.defaultUser,
      message: apiMessage({ embeds: [{ title: 'Missões' }] }),
    }),
  );
  assert.equal(legacy.deferredUpdate, true);
  // Conta em vez de comparar: as edições carregam PNGs e o diff do assert estoura a memória.
  assert.equal(legacy.edits.length, 0);
  assert.match(JSON.stringify(legacy.messages[0]), /Clube de slipher-tester/);
  assert.ok(Number(legacy.messages[0]?.flags) & MessageFlags.Ephemeral);

  bot.reset();
  const foreign = await bot.clickButton(navId('hub', stranger));
  assert.equal(foreign.deferredReply, true);
  assert.equal(foreign.ephemeral, true);
  assert.match(JSON.stringify(foreign.edits[0]), /Clube de slipher-tester/);
});

test('abrir pack revela a melhor carta e oferece abrir o próximo', async () => {
  const api = mockApi(game());
  await using bot = await createMockBot({ commands: [AbrirPackCommand] });

  const result = await bot.slash(AbrirPackCommand, { options: { pack: packId } });

  const frames = result.edits.map((edit) => messageText(edit));
  // Antecipação, brilho, walkout (posição → overall → nome) e o resultado, cada um com imagem.
  assert.equal(frames[0], '-# 📦 Rasgando o lacre…');
  assert.equal(frames[1], '-# 📦 Algo brilha dentro do pack…');
  assert.equal(frames[2], '-# 🟡 Carta lendária chegando…');
  assert.equal(frames[3], '-# 🟡 Carta lendária chegando…');
  assert.equal(frames[4], '### 🟡 91 · Rafael Lima');
  for (const edit of result.edits) assertPicture(edit);
  const final = result.edits.at(-1);
  assert.match(
    messageText(final),
    /🟡 \*\*91\*\* · Rafael Lima · `CA` · 🔴 Flamengo\n🟢 \*\*79\*\* · Bruno Costa · `MC` · 🔴 Flamengo/,
  );
  const next = messageButtons(final).find(({ label }) => label === 'Abrir outro (1)');
  assert.deepEqual(parseNavId(next?.customId ?? ''), {
    target: 'open',
    ownerId: owner,
    arg: packId,
  });
  assert.deepEqual(
    api.requests.map(({ method, path }) => `${method} ${path}`),
    [
      'POST /v1/team',
      'GET /v1/packs',
      `POST /v1/packs/${packId}/open`,
      'GET /v1/bot-responses/pack.open',
    ],
  );
});

test('abrir pack que o jogador não tem explica e não chama a API de abertura', async () => {
  const api = mockApi(game());
  await using bot = await createMockBot({ commands: [AbrirPackCommand] });

  const result = await bot.slash(AbrirPackCommand, {
    options: { pack: '00000000-0000-4000-8000-0000000000bb' },
  });

  assert.match(messageText(result.edits[0]), /Pack não encontrado no inventário/);
  assert.ok(!api.requests.some(({ path }) => path.endsWith('/open')));
});

test('/abrir-pack sem escolher lista os packs com botão de abrir', async () => {
  mockApi(game());
  await using bot = await createMockBot({ commands: [AbrirPackCommand] });

  const result = await bot.slash(AbrirPackCommand);

  assertPicture(result.messages[0], 'meus-packs.png');
  assert.match(messageText(result.messages[0]), /📦 \*\*Pack Ouro\*\* · 2×/);
  const open = messageButtons(result.messages[0]).find(({ label }) => label === 'Abrir');
  assert.equal(parseNavId(open?.customId ?? '')?.arg, packId);
});

test('autocomplete sugere só os packs do inventário', async () => {
  mockApi(game());
  await using bot = await createMockBot({ commands: [AbrirPackCommand] });

  const result = await bot.autocomplete({ name: 'abrir-pack', focused: 'pack', value: 'ouro' });

  assert.deepEqual(result.choices, [{ name: 'Pack Ouro · 2×', value: packId }]);
});

test('lucro em espera responde em privado com o tempo relativo', async () => {
  mockApi(
    game({
      '/v1/commands/lucro': {
        kind: 'cooldown',
        availableAt: '2030-01-01T00:00:00.000Z',
        embed: { title: '', description: '', color: '#000000', footer: '' },
      },
    }),
  );
  await using bot = await createMockBot({ commands: [LucroCommand] });

  const result = await bot.slash(LucroCommand);

  assert.equal(result.messages[0]?.flags, 32768 | MessageFlags.Ephemeral);
  assert.match(messageText(result.messages[0]), /libera de novo <t:1893456000:R>/);
});

test('/ajuda ensina os primeiros passos', async () => {
  await using bot = await createMockBot({ commands: [AjudaCommand] });

  const result = await bot.slash(AjudaCommand);

  assert.match(messageText(result.messages[0]), /Primeiros passos/);
  assert.ok(messageButtons(result.messages[0]).some(({ label }) => label === 'Abrir início'));
});

test('IDs de navegação rejeitam formatos inesperados', () => {
  assert.deepEqual(parseNavId('nv1:hub:123:_'), { target: 'hub', ownerId: '123', arg: '_' });
  assert.equal(parseNavId('nv1:apagar:123:_'), null);
  assert.equal(parseNavId('nv1:hub:abc:_'), null);
  assert.equal(parseNavId('nv1:open:123:../x'), null);
  assert.equal(parseNavId('nv1:hub:123:_:extra'), null);
});
