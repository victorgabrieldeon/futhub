import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createMockBot } from '@slipher/testing';

import TimeCommand from '../../src/commands/time.js';
import TimeButtonComponent from '../../src/components/time-button.js';
import TimeSelectComponent from '../../src/components/time-select.js';
import { renderTeamImage } from '../../src/team-image.js';
import type { TeamResponse, TeamTab } from '../../src/team-session.js';
import { type ApiRequest, mockApi } from '../support/api.js';

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
  packs: [{ id: 'pack-1', name: 'Pack Ouro', emoji: '📦', quantity: 2 }],
  collections: [],
};

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
  const api = mockApi(team);
  await using bot = await createMockBot({ commands: [TimeCommand] });

  const result = await bot.slash(TimeCommand);

  assert.equal(result.ephemeral, true);
  assert.match(body(result.messages), /MEU TIME · VISÃO GERAL/);
  assert.match(body(result.messages), /4-3-3/);
  assert.match(body(result.messages), /Elenco:.*12/);
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
      },
    },
  ]);
});

test('abre o painel público por prefixo, restringe os controles e mostra o clube', async () => {
  const api = mockApi((request: ApiRequest) => (request.path === '/v1/club' ? club : team));
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
  assert.equal(foreign.content, 'Este painel pertence a outro jogador.');

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
      { method: 'POST', path: '/v1/club' },
    ],
  );
});

test('melhora o estádio dentro do painel do time', async () => {
  let currentClub = club;
  const api = mockApi((request: ApiRequest) => {
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
  });
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
  assert.match(body(upgraded.messages), /Estádio melhorado/);
  assert.deepEqual(
    api.requests.map(({ method, path }) => ({ method, path })),
    [
      { method: 'POST', path: '/v1/team' },
      { method: 'POST', path: '/v1/club' },
      { method: 'POST', path: '/v1/club/stadium/upgrade' },
    ],
  );
});

test('gera uma imagem diferente para cada aba do time', async () => {
  const tabs: TeamTab[] = ['overview', 'lineup', 'inventory', 'packs', 'sale', 'club'];
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

test('salva a tática imediatamente e atualiza o painel', async () => {
  let current = team;
  const api = mockApi((request: ApiRequest) => {
    if (request.path === '/v1/team/tactic') {
      current = { ...current, tactic: 'offensive' };
      return {};
    }
    return current;
  });
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
      { method: 'PUT', path: '/v1/team/tactic' },
      { method: 'POST', path: '/v1/team' },
    ],
  );
});
