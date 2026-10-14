import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createMockBot } from '@slipher/testing';

import { type TeamImageTab, renderTeamImage } from '../../src/art/team-image.js';
import TimeCommand from '../../src/commands/time.js';
import TimeButtonComponent from '../../src/components/time-button.js';
import TimeSelectComponent from '../../src/components/time-select.js';
import type { TeamResponse } from '../../src/features/team/team-session.js';
import { type ApiRequest, messageText, mockApi } from '../support/api.js';

const club = {
  balance: 2_500,
  stadium: {
    level: 2,
    maxLevel: 5,
    nextUpgradeCost: 2_000,
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

const team = {
  balance: 475,
  strength: 880,
  inventoryCount: 12,
  tactic: 'balanced',
  formation: {
    id: '00000000-0000-4000-8000-000000000001',
    name: '4-3-3',
    slots: [],
  },
  formations: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: '4-3-3',
      slots: [],
    },
  ],
  lineup: [],
  inventory: { items: [], total: 12, page: 1, pageSize: 10, totalPages: 2 },
  packs: [
    { id: 'pack-1', name: 'Pack Ouro', emoji: '📦', cardsAmount: 3, imageUrl: null, quantity: 2 },
  ],
  collections: [],
  profile: { level: 3, xp: 40, nextLevelXp: 250 },
  profit: { availableAt: null },
};
const leagueTeam = {
  ...team,
  lineup: Array.from({ length: 11 }, (_, index) => ({
    userCardId: `league-card-${index}`,
    name: `Titular ${index + 1}`,
    imageUrl: null,
    overall: 80,
    position: 'CA',
    secondaryPositions: [],
    team: { name: 'Flamengo', emoji: '🔴' },
    collection: { id: 'collection-1', name: 'Base', emoji: '⚽' },
    favorite: false,
    holder: true,
    holderPosition: 'CA',
    captain: index === 0,
    sellPrice: 100,
    claimedAt: '2026-01-01T00:00:00.000Z',
  })),
} as TeamResponse;

const leagueDivision = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Bronze',
  minimumPoints: 0,
  emoji: '🏆',
  color: '#123abc',
  imageUrl: 'https://cdn.test/bronze.png',
};
const idleLeague = {
  points: 120,
  wins: 4,
  draws: 1,
  losses: 2,
  division: leagueDivision,
  queue: null,
};

/** Responde a liga e as missões carregadas pelo início e delega o resto para `fallback`. */
function withLeague(fallback: (request: ApiRequest) => unknown) {
  return (request: ApiRequest) =>
    request.path === '/v1/league'
      ? idleLeague
      : request.path === '/v1/missions'
        ? { missions: [] }
        : fallback(request);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function componentData(value: unknown): Record<string, unknown> | undefined {
  if (!record(value)) return undefined;
  return record(value.data) ? value.data : value;
}

function buttonId(messages: readonly { readonly components?: unknown[] }[], label: string): string {
  const container = messages[0]?.components?.[0];
  if (!record(container) || !Array.isArray(container.components))
    throw new Error('Team container missing.');
  const button = container.components
    .filter((component) => componentData(component)?.type === 1)
    .flatMap((row) => (record(row) && Array.isArray(row.components) ? row.components : []))
    .find((component) => {
      const data = componentData(component);
      return data?.type === 2 && data.label === label;
    });
  const data = componentData(button);
  if (typeof data?.custom_id !== 'string') throw new Error(`Team button ${label} missing.`);
  return data.custom_id;
}

function selectId(
  messages: readonly { readonly components?: unknown[] }[],
  placeholder: string,
): string {
  const container = messages[0]?.components?.[0];
  if (!record(container) || !Array.isArray(container.components))
    throw new Error('Team container missing.');
  const select = container.components
    .filter((component) => componentData(component)?.type === 1)
    .flatMap((row) => (record(row) && Array.isArray(row.components) ? row.components : []))
    .find((component) => {
      const data = componentData(component);
      return data?.type === 3 && data.placeholder === placeholder;
    });
  const data = componentData(select);
  if (typeof data?.custom_id !== 'string') throw new Error(`Team select ${placeholder} missing.`);
  return data.custom_id;
}

function body(messages: readonly { readonly components?: unknown[] }[]): string {
  const container = messages[0]?.components?.[0];
  if (!record(container) || !Array.isArray(container.components))
    throw new Error('Team container missing.');
  const display = container.components.find((component) => componentData(component)?.type === 10);
  const data = componentData(display);
  if (typeof data?.content !== 'string') throw new Error('Team body missing.');
  return data.content;
}

test('abre o painel privado do time por slash command', async () => {
  const api = mockApi(withLeague(() => team));
  await using bot = await createMockBot({ commands: [TimeCommand] });

  const result = await bot.slash(TimeCommand);

  // O início é a primeira aba: a arte do clube, o próximo passo e os atalhos.
  assert.equal(result.ephemeral, true);
  assert.equal(body(result.messages), '> **Próximo passo:** Seu lucro está pronto.');
  assert.match(JSON.stringify(result.messages), /attachment:\/\/inicio\.png/);
  assert.match(JSON.stringify(result.messages), /Clube de slipher-tester: nível 3, 475 moedas/);
  assert.match(JSON.stringify(result.messages), /"label":"Início","value":"overview"/);
  assert.equal(buttonId(result.messages, 'Abrir packs (2)').split(':')[1], 'packs');
  assert.deepEqual(api.requests, [
    {
      method: 'POST',
      path: '/v1/team',
      body: {
        identity: {
          id: '900000000000000005',
          name: 'slipher-tester',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
        },
        page: 1,
        name: '',
        position: null,
        collectionId: null,
        sort: 'overall',
        sellable: false,
      },
    },
    {
      method: 'POST',
      path: '/v1/league',
      body: {
        id: '900000000000000005',
        name: 'slipher-tester',
        avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
      },
    },
    {
      method: 'POST',
      path: '/v1/missions',
      body: {
        id: '900000000000000005',
        name: 'slipher-tester',
        avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
      },
    },
  ]);
});

test('abre o início mesmo sem liga e missões', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  const availableAt = '2026-10-10T15:00:00.000Z';
  mockApi((request: ApiRequest) => {
    if (request.path === '/v1/league' || request.path === '/v1/missions')
      throw new Error('offline');
    return { ...team, profit: { availableAt } };
  });
  await using bot = await createMockBot({ commands: [TimeCommand] });

  const result = await bot.slash(TimeCommand);

  assert.equal(body(result.messages), '> **Próximo passo:** Você tem 2 packs fechados.');
  assert.match(JSON.stringify(result.messages), /attachment:\/\/inicio\.png/);
  assert.match(JSON.stringify(result.messages), /"label":"Lucro em espera"/);
});
test('executa campanha, fila, resultado e nova busca na aba Liga', async (context) => {
  type Stage = 'idle' | 'waiting' | 'matched' | 'requeued';
  let stage: Stage = 'idle';
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === leagueDivision.imageUrl)
      return new Response(
        Uint8Array.from(
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'base64',
          ),
        ),
        { headers: { 'content-type': 'image/png' } },
      );
    return nativeFetch(input, init);
  };
  context.after(() => {
    globalThis.fetch = nativeFetch;
  });
  const leagueStatus = () => ({
    points: stage === 'matched' ? 3 : 0,
    wins: stage === 'matched' ? 1 : 0,
    draws: 0,
    losses: 0,
    division: leagueDivision,
    queue:
      stage === 'idle'
        ? null
        : stage === 'matched'
          ? { kind: 'matched', matchId: '00000000-0000-4000-8000-000000000003' }
          : { kind: 'waiting', division: leagueDivision },
  });
  const match = {
    id: '00000000-0000-4000-8000-000000000003',
    home: {
      id: '900000000000000005',
      name: 'slipher-tester',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
    },
    away: { id: '900000000000000006', name: 'Rival', avatarUrl: null },
    homeGoals: 2,
    awayGoals: 1,
    completedAt: '2026-08-15T12:00:00.000Z',
    events: [
      {
        sequence: 1,
        minute: 42,
        type: 'goal',
        playerUserCardId: null,
        assistUserCardId: null,
        description: 'Titular 1 abriu o placar',
        homeGoals: 1,
        awayGoals: 0,
      },
    ],
  };
  const api = mockApi((request: ApiRequest) => {
    if (request.path === '/v1/team') return leagueTeam;
    if (request.path === '/v1/league') return leagueStatus();
    if (request.path === '/v1/ranked/queue') {
      stage = stage === 'matched' ? 'requeued' : 'waiting';
      return leagueStatus().queue;
    }
    if (request.path === `/v1/matches/${match.id}`) return match;
    throw new Error(`Unexpected API request: ${request.method} ${request.path}`);
  });
  await using bot = await createMockBot({
    commands: [TimeCommand],
    components: [TimeButtonComponent, TimeSelectComponent],
  });

  const opened = await bot.slash(TimeCommand);
  bot.reset();
  const league = await bot.selectMenu(selectId(opened.messages, 'Escolha uma aba'), ['league']);
  const leaguePayload = JSON.stringify(league.messages);
  assert.equal(opened.ephemeral, true);
  assert.match(body(league.messages), /MEU TIME · LIGA/);
  assert.match(body(league.messages), /Bronze.*0 pontos/);
  assert.match(body(league.messages), /Vitórias:.*0.*Empates:.*0.*Derrotas:.*0/);
  assert.match(leaguePayload, /1194684/);
  assert.match(leaguePayload, /futhub-league-painel\.png/);
  assert.doesNotMatch(leaguePayload, /futhub-team\.png/);

  bot.reset();
  const waiting = await bot.clickButton(buttonId(league.messages, 'Buscar partida'));
  assert.match(body(waiting.messages), /Procurando adversário\./);
  // Enquanto espera, o painel anima e confere a fila sozinho antes de pedir um clique.
  assert.match(JSON.stringify(waiting.messages), /Procurando adversário\.\.\./);

  stage = 'matched';
  bot.reset();
  const result = await bot.clickButton(buttonId(waiting.messages, 'Atualizar'));
  assert.match(body(result.messages), /# 🏆 VITÓRIA!/);
  assert.match(body(result.messages), /## slipher-tester 2 × 1 Rival/);
  assert.match(body(result.messages), /Resultado:.*Vitória/);
  assert.match(JSON.stringify(result.messages), /"accent_color":2071893/);
  assert.match(body(result.messages), /42'` \S+ Titular 1 abriu o placar/);

  bot.reset();
  const requeued = await bot.clickButton(buttonId(result.messages, 'Buscar nova partida'));
  assert.match(body(requeued.messages), /Procurando adversário/);
  // Entrar na fila carrega a liga e confere mais 4 vezes enquanto anima a busca.
  const searching = Array.from({ length: 5 }, () => ({ method: 'POST', path: '/v1/league' }));
  assert.deepEqual(
    api.requests.map(({ method, path }) => ({ method, path })),
    [
      { method: 'POST', path: '/v1/team' },
      { method: 'POST', path: '/v1/league' },
      { method: 'POST', path: '/v1/missions' },
      { method: 'POST', path: '/v1/league' },
      { method: 'POST', path: '/v1/ranked/queue' },
      ...searching,
      { method: 'POST', path: '/v1/league' },
      { method: 'GET', path: `/v1/matches/${match.id}` },
      { method: 'POST', path: '/v1/ranked/queue' },
      ...searching,
    ],
  );
});

test('abre o painel público por prefixo, restringe os controles e mostra o clube', async () => {
  const api = mockApi(withLeague((request) => (request.path === '/v1/club' ? club : team)));
  await using bot = await createMockBot({
    commands: [TimeCommand],
    components: [TimeButtonComponent, TimeSelectComponent],
    prefixes: ['!'],
  });

  const opened = await bot.say('!time');
  const tabs = selectId(opened.messages, 'Escolha uma aba');

  const foreign = await bot.selectMenu(tabs, ['inventory'], {
    userId: '900000000000000006',
  });
  assert.equal(foreign.ephemeral, true);
  assert.match(messageText(foreign.messages[0]), /Este painel não é seu/);

  bot.reset();
  const switched = await bot.selectMenu(tabs, ['inventory']);
  assert.match(body(switched.messages), /MEU TIME · ELENCO/);

  bot.reset();
  const packs = await bot.selectMenu(selectId(switched.messages, 'Escolha uma aba'), ['packs']);
  assert.match(body(packs.messages), /MEU TIME · PACKS/);
  assert.match(body(packs.messages), /Pack Ouro.*2x/);

  bot.reset();
  const clubPanel = await bot.selectMenu(selectId(packs.messages, 'Escolha uma aba'), ['club']);
  assert.match(body(clubPanel.messages), /MEU TIME · CLUBE/);
  assert.match(body(clubPanel.messages), /Estádio:.*nível 2\/5/);
  assert.deepEqual(
    api.requests.map(({ method, path }) => ({ method, path })),
    [
      { method: 'POST', path: '/v1/team' },
      { method: 'POST', path: '/v1/league' },
      { method: 'POST', path: '/v1/missions' },
      { method: 'POST', path: '/v1/club' },
    ],
  );
});

test('melhora o estádio dentro do painel do time', async () => {
  let currentClub = club;
  const api = mockApi(
    withLeague((request) => {
      if (request.path === '/v1/club/stadium/upgrade') {
        currentClub = {
          ...currentClub,
          balance: 500,
          stadium: {
            ...currentClub.stadium,
            level: 3,
            nextUpgradeCost: 3_000,
            ticketRevenue: 600,
            maintenance: 150,
          },
          projectedNet: 370,
        };
      }
      return request.path.startsWith('/v1/club') ? currentClub : team;
    }),
  );
  await using bot = await createMockBot({
    commands: [TimeCommand],
    components: [TimeButtonComponent, TimeSelectComponent],
  });

  const opened = await bot.slash(TimeCommand);
  bot.reset();
  const clubPanel = await bot.selectMenu(selectId(opened.messages, 'Escolha uma aba'), ['club']);
  const upgrade = buttonId(clubPanel.messages, 'Melhorar estádio · 2.000');
  bot.reset();
  const upgraded = await bot.clickButton(upgrade);

  assert.match(body(upgraded.messages), /Estádio:.*nível 3\/5/);
  assert.match(body(upgraded.messages), /## 🏟️ Estádio nível 3!/);
  assert.deepEqual(
    api.requests.map(({ method, path }) => ({ method, path })),
    [
      { method: 'POST', path: '/v1/team' },
      { method: 'POST', path: '/v1/league' },
      { method: 'POST', path: '/v1/missions' },
      { method: 'POST', path: '/v1/club' },
      { method: 'POST', path: '/v1/club/stadium/upgrade' },
    ],
  );
});

test('gera uma imagem diferente para cada aba do time', async () => {
  const tabs: TeamImageTab[] = ['lineup', 'inventory', 'packs', 'sale', 'club'];
  const images = await Promise.all(
    tabs.map((tab) =>
      renderTeamImage({
        identity: { id: 'player-1', name: 'slipher-tester', avatarUrl: null },
        tab,
        team: team as TeamResponse,
        club,
      }),
    ),
  );

  for (const image of images)
    assert.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const decoded = await Promise.all(images.map((image) => loadImage(image)));
  assert.deepEqual(
    decoded.map((image) => [image.width, image.height]),
    [
      [2_400, 1_640],
      [2_400, 1_350],
      [2_400, 1_350],
      [2_400, 1_350],
      [2_400, 1_640],
    ],
  );
  assert.equal(new Set(images.map((image) => image.toString('base64'))).size, tabs.length);
});

test('muda visualmente o estádio conforme o nível', async () => {
  const input = {
    identity: { id: 'player-1', name: 'slipher-tester', avatarUrl: null },
    tab: 'club' as const,
    team: team as TeamResponse,
  };
  const [levelOne, levelFive] = await Promise.all([
    renderTeamImage({
      ...input,
      club: { ...club, stadium: { ...club.stadium, level: 1 } },
    }),
    renderTeamImage({
      ...input,
      club: { ...club, stadium: { ...club.stadium, level: 5, nextUpgradeCost: null } },
    }),
  ]);

  assert.notEqual(levelOne.toString('base64'), levelFive.toString('base64'));
});

test('mostra a carta completa do jogador e mantém fallback sem imagem', async () => {
  const player: TeamResponse['lineup'][number] = {
    userCardId: 'card-1',
    name: 'Camisa 10',
    imageUrl: null,
    overall: 91,
    position: 'CA',
    secondaryPositions: [],
    team: { name: 'Flamengo', emoji: '🔴' },
    collection: { id: 'collection-1', name: 'Lendas', emoji: 'L' },
    favorite: false,
    holder: true,
    holderPosition: 'CA',
    captain: true,
    sellPrice: 100,
    claimedAt: '2026-01-01T00:00:00.000Z',
  };
  const playerTeam = {
    ...team,
    formation: { ...team.formation, slots: [{ id: 'slot-1', position: 'CA', x: 50, y: 20 }] },
    lineup: [player],
    inventory: { ...team.inventory, items: [player] },
  } as TeamResponse;
  const input = {
    identity: { id: 'player-1', name: 'slipher-tester', avatarUrl: null },
    tab: 'lineup' as const,
  };
  const fallback = await renderTeamImage({ ...input, team: playerTeam });
  const photo = createCanvas(4, 6);
  const photoContext = photo.getContext('2d');
  photoContext.fillStyle = '#d30005';
  photoContext.fillRect(0, 0, 4, 6);
  const pictured = await renderTeamImage({
    ...input,
    team: {
      ...playerTeam,
      lineup: [
        {
          ...player,
          imageUrl: `data:image/png;base64,${photo.toBuffer('image/png').toString('base64')}`,
        },
      ],
    },
  });

  const rendered = await loadImage(pictured);
  const renderedCanvas = createCanvas(rendered.width, rendered.height);
  const renderedContext = renderedCanvas.getContext('2d');
  renderedContext.drawImage(rendered, 0, 0);

  assert.deepEqual(fallback.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.deepEqual([...renderedContext.getImageData(850, 640, 1, 1).data], [211, 0, 5, 255]);
});

test('carrega cartas do MinIO pelo endereço interno no cluster', async () => {
  const originalFetch = globalThis.fetch;
  const originalPublicUrl = process.env.MINIO_PUBLIC_URL;
  const originalInternalUrl = process.env.MINIO_INTERNAL_URL;
  const card = createCanvas(4, 6);
  card.getContext('2d').fillRect(0, 0, 4, 6);
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(card.toBuffer('image/png'), { headers: { 'content-type': 'image/png' } });
  };
  process.env.MINIO_PUBLIC_URL = 'http://s3.futhub.localhost:8080';
  process.env.MINIO_INTERNAL_URL = 'http://minio:9000';

  try {
    await renderTeamImage({
      identity: { id: 'player-1', name: 'slipher-tester', avatarUrl: null },
      tab: 'lineup',
      team: {
        ...team,
        formation: { ...team.formation, slots: [{ id: 'slot-1', position: 'CA', x: 50, y: 20 }] },
        lineup: [
          {
            userCardId: 'internal-image-card',
            name: 'Camisa 10',
            imageUrl: 'http://s3.futhub.localhost:8080/cards/player.png',
            overall: 91,
            position: 'CA',
            secondaryPositions: [],
            team: { name: 'Flamengo', emoji: '🔴' },
            collection: { id: 'collection-1', name: 'Lendas', emoji: 'L' },
            favorite: false,
            holder: true,
            holderPosition: 'CA',
            captain: false,
            sellPrice: 100,
            claimedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      } as TeamResponse,
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MINIO_PUBLIC_URL = originalPublicUrl;
    process.env.MINIO_INTERNAL_URL = originalInternalUrl;
  }

  assert.equal(requestedUrl, 'http://minio:9000/cards/player.png');
});

test('aba Packs desenha a arte salva de cada pack', async (context) => {
  const nativeFetch = globalThis.fetch;
  const art = createCanvas(60, 80);
  const paint = art.getContext('2d');
  paint.fillStyle = '#ff00ff';
  paint.fillRect(0, 0, 60, 80);
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response(art.toBuffer('image/png'), { headers: { 'content-type': 'image/png' } });
  };
  context.after(() => {
    globalThis.fetch = nativeFetch;
  });
  const render = (imageUrl: string | null) =>
    renderTeamImage({
      identity: { id: 'player-1', name: 'slipher-tester', avatarUrl: null },
      tab: 'packs',
      team: {
        ...team,
        packs: [{ ...team.packs[0], imageUrl }],
      } as TeamResponse,
    });

  const fallback = await render(null);
  const saved = await render('https://cdn.test/packs/ouro.png');

  assert.deepEqual(requested, ['https://cdn.test/packs/ouro.png']);
  assert.notEqual(saved.toString('base64'), fallback.toString('base64'));
});

test('salva a tática imediatamente e atualiza o painel', async () => {
  let current = team;
  const api = mockApi(
    withLeague((request) => {
      if (request.path === '/v1/team/tactic') {
        current = { ...current, tactic: 'offensive' };
        return {};
      }
      return current;
    }),
  );
  await using bot = await createMockBot({
    commands: [TimeCommand],
    components: [TimeButtonComponent, TimeSelectComponent],
  });

  const opened = await bot.slash(TimeCommand);
  bot.reset();
  const lineup = await bot.selectMenu(selectId(opened.messages, 'Escolha uma aba'), ['lineup']);
  assert.match(JSON.stringify(lineup.messages), /Escolha uma formação/);
  assert.match(body(lineup.messages), /Formação:.*4-3-3.*Tática:.*Equilibrada/);
  bot.reset();
  const updated = await bot.clickButton(buttonId(lineup.messages, 'Ofensiva'));

  assert.match(body(updated.messages), /Tática:.*Ofensiva/);
  assert.deepEqual(
    api.requests.map(({ method, path }) => ({ method, path })),
    [
      { method: 'POST', path: '/v1/team' },
      { method: 'POST', path: '/v1/league' },
      { method: 'POST', path: '/v1/missions' },
      { method: 'PUT', path: '/v1/team/tactic' },
      { method: 'POST', path: '/v1/team' },
    ],
  );
});

test('lista só vendáveis na aba Venda e vende vários jogadores de uma vez', async () => {
  const reserve = (index: number) => ({
    ...leagueTeam.lineup[0],
    userCardId: `reserve-${index}`,
    name: `Reserva ${index}`,
    holder: false,
    holderPosition: null,
    captain: false,
    sellPrice: 100 * index,
  });
  const saleTeam = {
    ...team,
    inventory: {
      items: [reserve(1), reserve(2), reserve(3)],
      total: 3,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    },
  } as TeamResponse;
  const api = mockApi(
    withLeague((request) => {
      if (request.path === '/v1/cards/sell')
        return { amount: 300, balance: 775, completedMissions: [] };
      return record(request.body) && request.body.sellable ? saleTeam : team;
    }),
  );
  await using bot = await createMockBot({
    commands: [TimeCommand],
    components: [TimeButtonComponent, TimeSelectComponent],
  });

  const opened = await bot.slash(TimeCommand);
  bot.reset();
  const sale = await bot.selectMenu(selectId(opened.messages, 'Escolha uma aba'), ['sale']);
  assert.match(body(sale.messages), /3 jogador\(es\) disponível\(is\) para venda/);
  bot.reset();
  const picked = await bot.selectMenu(selectId(sale.messages, 'Selecione jogadores para vender'), [
    'reserve-1',
    'reserve-2',
  ]);
  assert.match(body(picked.messages), /2 selecionado\(s\)\*\* · Total: \*\*300\*\*/);
  bot.reset();
  const confirm = await bot.clickButton(buttonId(picked.messages, 'Vender 2 jogadores'));
  bot.reset();
  const sold = await bot.clickButton(buttonId(confirm.messages, 'Confirmar venda por 300'));

  assert.match(body(sold.messages), /\*\*2 jogadores\*\* vendidos · saldo 775/);
  const teamRequests = api.requests.filter(({ path }) => path === '/v1/team');
  assert.deepEqual(
    teamRequests.map(({ body }) => record(body) && body.sellable),
    [false, true, true],
  );
  const saleRequest = api.requests.find(({ path }) => path === '/v1/cards/sell');
  assert.deepEqual(record(saleRequest?.body) && saleRequest.body.userCardIds, [
    'reserve-1',
    'reserve-2',
  ]);
});
