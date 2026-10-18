import assert from 'node:assert/strict';
import test from 'node:test';
import type { SimulateTestMatch200 } from '@futhub/api-client';
import { type DispatchResult, createMockBot } from '@slipher/testing';
import type { ComponentContext } from 'seyfert';

import TimeCommand from '../../src/commands/time.js';
import TimeButtonComponent from '../../src/components/time-button.js';
import TimeOpponentComponent from '../../src/components/time-opponent.js';
import TimeSelectComponent from '../../src/components/time-select.js';
import { juice } from '../../src/core/juice.js';
import type { TeamResponse } from '../../src/features/team/team-session.js';
import {
  createTeamSession,
  parseTeamAction,
  teamCustomId,
} from '../../src/features/team/team-session.js';
import { type ApiRequest, messageButtons, messageText, mockApi } from '../support/api.js';

juice.frameDelayMs = 0;
const ownerId = '900000000000000005';
const opponentId = '900000000000000006';
const userSelect = {
  componentType: 'user' as const,
  resolved: {
    users: Object.fromEntries(
      [ownerId, opponentId].map((id) => [
        id,
        { id, username: 'Jogador', discriminator: '0', avatar: null, bot: false },
      ]),
    ),
  },
};
const team: TeamResponse = {
  balance: 0,
  strength: 880,
  inventoryCount: 11,
  tactic: 'balanced',
  formation: { id: 'formation', name: '4-3-3', slots: [] },
  formations: [],
  lineup: Array.from({ length: 11 }, (_, index) => ({
    userCardId: `card-${index}`,
    name: `Titular ${index}`,
    imageUrl: null,
    overall: 80,
    position: 'CA',
    secondaryPositions: [],
    team: { name: 'Clube', emoji: '' },
    collection: { id: 'base', name: 'Base', emoji: '' },
    favorite: false,
    holder: true,
    holderPosition: 'CA',
    captain: index === 0,
    sellPrice: 10,
    claimedAt: '2026-01-01T00:00:00.000Z',
  })),
  inventory: { items: [], total: 11, page: 1, pageSize: 10, totalPages: 1 },
  packs: [],
  collections: [],
  profile: { level: 1, xp: 0, nextLevelXp: 100 },
  profit: { availableAt: null },
};
const match: SimulateTestMatch200 = {
  seed: 123,
  difficulty: 'medium',
  home: {
    name: 'Seu time',
    avatarUrl: null,
    cpu: false,
    tactic: 'balanced',
    rating: 80,
    lineup: [],
    slots: [],
  },
  away: {
    name: 'FutHub CPU',
    avatarUrl: null,
    cpu: true,
    tactic: 'balanced',
    rating: 80,
    lineup: [],
    slots: [],
  },
  homeGoals: 1,
  awayGoals: 0,
  events: [
    { minute: 0, type: 'kickoff', description: 'Começou.', homeGoals: 0, awayGoals: 0 },
    { minute: 42, type: 'goal', description: 'Gol do seu time!', homeGoals: 1, awayGoals: 0 },
    { minute: 90, type: 'fulltime', description: 'Fim de jogo.', homeGoals: 1, awayGoals: 0 },
  ],
};
const league = {
  points: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  queue: null,
  division: {
    id: 'division',
    name: 'Bronze',
    minimumPoints: 0,
    emoji: '',
    color: null,
    imageUrl: null,
  },
};
const components = [TimeButtonComponent, TimeSelectComponent, TimeOpponentComponent];
function controlsFor(bot: Awaited<ReturnType<typeof createMockBot>>) {
  return (result: DispatchResult, label: string) => {
    const selection =
      label === 'Escolha uma aba'
        ? 'tab'
        : label === 'Escolha o adversário do amistoso'
          ? 'opponent'
          : undefined;
    const message = result.messages.at(-1);
    const button = messageButtons(message).find((item) => item.label === label);
    const customId =
      button?.customId ??
      (selection
        ? new RegExp(`"custom_id":"(tm1:[^"]+:${selection}:[^"]+)"`).exec(
            JSON.stringify(message?.components),
          )?.[1]
        : undefined);
    assert.ok(customId, `Missing control: ${label}`);
    return {
      customId,
      disabled: button?.disabled,
      click: () => {
        bot.reset();
        return bot.clickButton(customId);
      },
      select: (values: string[], options?: Parameters<typeof bot.selectMenu>[2]) => {
        bot.reset();
        return bot.selectMenu(customId, values, options);
      },
    };
  };
}
function setup(currentTeam = team) {
  return mockApi((request: ApiRequest) => {
    if (request.path === '/v1/team') return currentTeam;
    if (request.path === '/v1/league') return league;
    if (request.path === '/v1/missions') return { missions: [] };
    if (request.path === '/v1/matches/test') {
      const input = request.body as {
        difficulty: 'easy' | 'medium' | 'hard';
        opponentId: string | null;
      };
      return {
        ...match,
        difficulty: input.opponentId ? null : input.difficulty,
        away: {
          ...match.away,
          cpu: !input.opponentId,
          name: input.opponentId ? 'Rival' : 'FutHub CPU',
        },
      };
    }
    throw new Error(`Unexpected API request: ${request.path}`);
  });
}

for (const [difficulty, label] of [
  ['easy', 'Fácil'],
  ['medium', 'Médio'],
  ['hard', 'Difícil'],
] as const) {
  test(`joga contra bot ${label} na aba Partida sem antecipar o resultado`, async () => {
    const api = setup();
    await using bot = await createMockBot({ commands: [TimeCommand], components });
    const action = controlsFor(bot);
    const opened = await bot.slash(TimeCommand);
    assert.match(JSON.stringify(opened.messages), /"label":"Partida","value":"match"/);
    const lobby = await action(opened, 'Escolha uma aba').select(['match']);
    assert.match(messageText(lobby.messages.at(-1)), /MEU TIME · PARTIDA/);
    for (const mode of ['Liga', 'Amistoso', 'Contra bots']) assert.ok(action(lobby, mode));
    const bots = await action(lobby, 'Contra bots').click();
    const selected = await action(bots, label).click();
    assert.match(messageText(selected.messages.at(-1)), new RegExp(`Contra bots · ${label}`));
    const start = action(selected, 'Iniciar partida');
    const played = await start.click();
    assert.match(messageText(played.messages[1]), /Seu time 0 × 0 FutHub CPU/);
    assert.doesNotMatch(messageText(played.messages[1]), /Gol do seu time|Vitória/);
    assert.ok(messageButtons(played.messages[1]).every((button) => button.disabled));
    assert.match(messageText(played.messages.at(-1)), /FIM DE JOGO · Vitória/);
    assert.match(messageText(played.messages.at(-1)), new RegExp(`Contra bots · ${label}`));
    assert.equal(
      messageButtons(played.messages.at(-1)).find((button) => button.label === 'Jogar novamente')
        ?.disabled,
      false,
    );
    assert.deepEqual(
      api.requests.filter(({ path }) => path === '/v1/matches/test').map(({ body }) => body),
      [
        {
          identity: {
            id: ownerId,
            name: 'slipher-tester',
            avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
          },
          opponentId: null,
          difficulty,
        },
      ],
    );
    assert.equal(api.requests.filter(({ path }) => path === '/v1/ranked/queue').length, 0);
    const state = parseTeamAction(start.customId ?? '', ownerId);
    assert.equal(state.kind === 'owned' && state.session.matchBusy, false);
    const replayed = await action(played, 'Jogar novamente').click();
    assert.match(messageText(replayed.messages.at(-1)), /FIM DE JOGO/);
    assert.equal(api.requests.filter(({ path }) => path === '/v1/matches/test').length, 2);
  });
}

test('seleciona outro jogador para amistoso e rejeita o próprio dono e terceiros', async () => {
  const api = setup();
  await using bot = await createMockBot({ commands: [TimeCommand], components });
  const action = controlsFor(bot);
  const opened = await bot.slash(TimeCommand);
  const lobby = await action(opened, 'Escolha uma aba').select(['match']);
  const friendly = await action(lobby, 'Amistoso').click();
  assert.equal(action(friendly, 'Iniciar partida').disabled, true);
  const picker = action(friendly, 'Escolha o adversário do amistoso');
  const self = await picker.select([ownerId], userSelect);
  assert.match(messageText(self.messages[0]), /não pode enfrentar seu próprio time/);
  const foreign = await picker.select([opponentId], { ...userSelect, userId: opponentId });
  assert.match(messageText(foreign.messages[0]), /Este painel não é seu/);
  const chosen = await picker.select([opponentId], userSelect);
  assert.match(messageText(chosen.messages.at(-1)), new RegExp(`<@${opponentId}>`));
  const played = await action(chosen, 'Iniciar partida').click();
  assert.match(messageText(played.messages.at(-1)), /Seu time 1 × 0 Rival/);
  const request = api.requests.find(({ path }) => path === '/v1/matches/test');
  assert.equal((request?.body as { opponentId: string }).opponentId, opponentId);
});

test('avisa sobre escalação incompleta e mantém partida desabilitada', async () => {
  const api = setup({ ...team, lineup: [] });
  await using bot = await createMockBot({ commands: [TimeCommand], components });
  const action = controlsFor(bot);
  const opened = await bot.slash(TimeCommand);
  const lobby = await action(opened, 'Escolha uma aba').select(['match']);
  const bots = await action(lobby, 'Contra bots').click();
  assert.match(messageText(bots.messages.at(-1)), /Complete os 11 titulares/);
  assert.equal(action(bots, 'Iniciar partida').disabled, true);
  assert.equal(api.requests.filter(({ path }) => path === '/v1/matches/test').length, 0);
});

test('sem animações, exibe somente preparação e resultado final', async () => {
  setup();
  await using bot = await createMockBot({ commands: [TimeCommand], components });
  const action = controlsFor(bot);
  const opened = await bot.slash(TimeCommand);
  const lobby = await action(opened, 'Escolha uma aba').select(['match']);
  const bots = await action(lobby, 'Contra bots').click();
  juice.enabled = false;
  try {
    const result = await action(bots, 'Iniciar partida').click();
    assert.equal(result.messages.length, 2);
    assert.match(messageText(result.messages.at(-1)), /FIM DE JOGO/);
  } finally {
    juice.enabled = true;
  }
});

test('erro de escalação do adversário permite tentar novamente no mesmo painel', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  setup();
  await using bot = await createMockBot({ commands: [TimeCommand], components });
  const action = controlsFor(bot);
  const opened = await bot.slash(TimeCommand);
  const lobby = await action(opened, 'Escolha uma aba').select(['match']);
  const friendly = await action(lobby, 'Amistoso').click();
  const chosen = await action(friendly, 'Escolha o adversário do amistoso').select(
    [opponentId],
    userSelect,
  );
  mockApi({ message: 'O adversário ainda não tem 11 titulares escalados.' }, 400);
  const failed = await action(chosen, 'Iniciar partida').click();
  assert.match(messageText(failed.messages.at(-1)), /adversário ainda não tem 11 titulares/);
  assert.equal(action(failed, 'Iniciar partida').disabled, false);
  setup();
  const retried = await action(failed, 'Iniciar partida').click();
  assert.match(messageText(retried.messages.at(-1)), /FIM DE JOGO/);
});

test('opção Liga abre a campanha existente dentro da aba Partida', async () => {
  setup();
  await using bot = await createMockBot({ commands: [TimeCommand], components });
  const action = controlsFor(bot);
  const opened = await bot.slash(TimeCommand);
  const lobby = await action(opened, 'Escolha uma aba').select(['match']);
  const ranked = await action(lobby, 'Liga').click();
  assert.match(messageText(ranked.messages.at(-1)), /MEU TIME · LIGA/);
  assert.ok(action(ranked, 'Buscar partida'));
  assert.ok(action(ranked, 'Contra bots'));
});

test('bloqueia cliques duplicados antes do deferUpdate e durante a partida', async () => {
  const api = mockApi(match);
  const session = createTeamSession({
    ownerId,
    identity: { id: ownerId, name: 'Seu time', avatarUrl: null },
    ephemeral: true,
    tab: 'match',
    matchMode: 'bots',
    team,
    club: null,
    league: null,
    missions: null,
    filters: { name: '', position: null, collectionId: null, sort: 'overall' },
    selectedCardIds: [],
    confirmSale: false,
  });
  const customId = teamCustomId(session, 'match-play');
  const blocked: string[] = [];
  let checked = false;
  let acknowledge = () => {};
  const deferred = new Promise<void>((resolve) => {
    acknowledge = resolve;
  });
  const context = {
    customId,
    interaction: { user: { id: ownerId } },
    deferUpdate: () => deferred,
    write: async (message: { content: string }) => {
      blocked.push(message.content);
    },
    editOrReply: async () => {
      if (checked) return;
      checked = true;
      await new TimeButtonComponent().run(context as unknown as ComponentContext<'Button'>);
    },
  };
  const playing = new TimeButtonComponent().run(context as unknown as ComponentContext<'Button'>);
  await new TimeButtonComponent().run(context as unknown as ComponentContext<'Button'>);
  acknowledge();
  await playing;
  assert.deepEqual(blocked, Array(2).fill('A partida está em andamento. Aguarde o apito final.'));
  assert.equal(api.requests.length, 1);
  const current = parseTeamAction(customId, ownerId);
  assert.equal(current.kind === 'owned' && current.session.matchBusy, false);
});
