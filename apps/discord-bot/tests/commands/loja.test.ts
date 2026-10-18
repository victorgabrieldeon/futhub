import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { createMockBot } from '@slipher/testing';

import LojaCommand from '../../src/commands/loja.js';
import LojaPackSelectComponent from '../../src/components/loja-pack-select.js';
import LojaTabComponent from '../../src/components/loja-tab.js';
import { EMOJI } from '../../src/core/emojis.js';
import { storeSessionManager } from '../../src/features/store/store.js';
import {
  type ApiRequest,
  messageButtons,
  messageText,
  mockApi,
  withTemplates,
} from '../support/api.js';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const cardId = '00000000-0000-4000-8000-000000000001';
const marketCard = {
  id: cardId,
  name: 'Camisa 10',
  imageUrl: '',
  overall: 91,
  position: 'MA',
  secondaryPositions: ['MC'],
  defense: 45,
  attack: 90,
  creation: 94,
  passing: 92,
  control: 93,
  marking: 40,
  pace: 86,
  dribbling: 91,
  finishing: 88,
  price: 500,
  team: { id: '00000000-0000-4000-8000-000000000010', name: 'FutHub FC', emoji: 'FH' },
  collection: {
    id: '00000000-0000-4000-8000-000000000020',
    name: 'Craques',
    emoji: 'C',
  },
};
const marketPage = { items: [marketCard], total: 1, page: 1, pageSize: 10, totalPages: 1 };
const marketCatalog = { teams: [marketCard.team], collections: [marketCard.collection] };

function storeButtonId(
  messages: readonly { readonly components?: unknown[] }[],
  label: string,
): string {
  const container = messages[0]?.components?.[0];
  if (!record(container) || !Array.isArray(container.components))
    throw new Error('Store container missing.');
  const button = container.components
    .filter((component) => record(component) && record(component.data) && component.data.type === 1)
    .flatMap((row) => (record(row) && Array.isArray(row.components) ? row.components : []))
    .find(
      (component) =>
        record(component) &&
        record(component.data) &&
        component.data.type === 2 &&
        component.data.label === label,
    );
  if (!record(button) || !record(button.data) || typeof button.data.custom_id !== 'string')
    throw new Error(`Store tab ${label} missing.`);
  return button.data.custom_id;
}

function storeSelectId(
  messages: readonly { readonly components?: unknown[] }[],
  placeholder?: string,
): string {
  const container = messages[0]?.components?.[0];
  if (!record(container) || !Array.isArray(container.components))
    throw new Error('Store container missing.');
  const select = container.components
    .filter((component) => record(component) && record(component.data) && component.data.type === 1)
    .flatMap((row) => (record(row) && Array.isArray(row.components) ? row.components : []))
    .find(
      (component) =>
        record(component) &&
        record(component.data) &&
        component.data.type === 3 &&
        (!placeholder || component.data.placeholder === placeholder),
    );
  if (!record(select) || !record(select.data) || typeof select.data.custom_id !== 'string')
    throw new Error(`Store select ${placeholder ?? ''} missing.`);
  return select.data.custom_id;
}

function storeBody(messages: readonly { readonly components?: unknown[] }[]): string {
  const container = messages[0]?.components?.[0];
  if (!record(container) || !Array.isArray(container.components))
    throw new Error('Store container missing.');
  const display = container.components.find(
    (component) => record(component) && record(component.data) && component.data.type === 10,
  );
  if (!record(display) || !record(display.data) || typeof display.data.content !== 'string')
    throw new Error('Store body missing.');
  return display.data.content;
}

test('abre uma loja assinada e alterna para contratar pelo dono', async () => {
  const api = mockApi((request: ApiRequest) => {
    if (request.path === '/v1/cards') return marketPage;
    if (request.path === '/v1/cards/catalog') return marketCatalog;
    return [
      {
        id: 'pack-1',
        name: 'Pack Ouro',
        emoji: '📦',
        cardsAmount: 3,
        price: 50,
        limitPerUser: 2,
      },
    ];
  });

  await using bot = await createMockBot({
    commands: [LojaCommand],
    components: [LojaTabComponent],
    prefixes: ['!'],
  });

  const result = await bot.slash(LojaCommand);
  const contratar = storeButtonId(result.messages, 'Contratar');

  assert.match(JSON.stringify(result.messages), /Pack Ouro/);
  assert.match(contratar, /^ls1:/);
  bot.reset();
  const switched = await bot.clickButton(contratar);
  assert.match(storeBody(switched.messages), /Mercado de jogadores/);
  assert.match(storeBody(switched.messages), /Camisa 10/);
  const persisted = storeSessionManager.parse(contratar, '900000000000000005');
  assert.equal(persisted.kind, 'owned');
  if (persisted.kind === 'owned') assert.equal(persisted.session.state.tab, 'contratar');
  assert.deepEqual(api.requests, [
    { method: 'GET', path: '/v1/packs', body: null },
    { method: 'GET', path: '/v1/cards', body: null },
    { method: 'GET', path: '/v1/cards/catalog', body: null },
  ]);
});

test('lista, seleciona e contrata uma carta pelo fluxo interativo', async () => {
  const api = mockApi((request: ApiRequest) => {
    if (request.path === '/v1/cards') return marketPage;
    if (request.path === '/v1/cards/catalog') return marketCatalog;
    if (request.path === `/v1/cards/${cardId}/purchase`)
      return { userCardId: 'user-card-1', price: 500, balance: 1_250, completedMissions: [] };
    if (request.path.startsWith('/v1/bot-responses/')) return withTemplates({})(request);
    return [
      {
        id: 'pack-1',
        name: 'Pack Ouro',
        emoji: 'P',
        cardsAmount: 3,
        price: 50,
        limitPerUser: 2,
      },
    ];
  });

  await using bot = await createMockBot({
    commands: [LojaCommand],
    components: [LojaTabComponent, LojaPackSelectComponent],
  });

  const opened = await bot.slash(LojaCommand);
  const contratarTab = storeButtonId(opened.messages, 'Contratar');
  bot.reset();
  const market = await bot.clickButton(contratarTab);
  const positionMenu = storeSelectId(market.messages, 'Filtrar por posição');
  bot.reset();
  const filtered = await bot.selectMenu(positionMenu, ['MA']);
  const cardMenu = storeSelectId(filtered.messages, 'Escolha um jogador para ver e contratar');

  bot.reset();
  const detail = await bot.selectMenu(cardMenu, [cardId]);
  assert.equal(detail.ephemeral, true);
  assert.match(JSON.stringify(detail.messages), /Camisa 10 · 91/);
  const buy = storeButtonId(detail.messages, 'Contratar');

  bot.reset();
  const purchased = await bot.clickButton(buy);
  const payload = JSON.stringify(purchased.messages);
  assert.match(payload, /CONTRATAÇÃO FECHADA\\n# 91 · Camisa 10\\n`MA` · carta Lendária/);
  assert.match(payload, /🪙 \*\*−500\*\* {2}· {2}saldo 1\.250/);
  assert.match(payload, /"label":"Escalar"/);

  bot.reset();
  const duplicate = await bot.clickButton(buy);
  assert.match(messageText(duplicate.messages[0]), /Este jogador já foi contratado/);
  const filteredUrl = new URL(api.urls[3] ?? '', 'https://api.test');
  assert.deepEqual(filteredUrl.searchParams.getAll('positions'), ['MA']);
  assert.equal(filteredUrl.searchParams.get('sort'), 'recent');
  assert.deepEqual(api.requests, [
    { method: 'GET', path: '/v1/packs', body: null },
    { method: 'GET', path: '/v1/cards', body: null },
    { method: 'GET', path: '/v1/cards/catalog', body: null },
    { method: 'GET', path: '/v1/cards', body: null },
    {
      method: 'POST',
      path: `/v1/cards/${cardId}/purchase`,
      body: {
        identity: {
          id: '900000000000000005',
          name: 'slipher-tester',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
        },
      },
    },
    { method: 'GET', path: '/v1/bot-responses/card.purchase', body: null },
  ]);
});

test('não contrata outra carta por um detalhe antigo', async () => {
  const secondCard = {
    ...marketCard,
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Centroavante',
    position: 'CA',
  };
  const api = mockApi((request: ApiRequest) => {
    if (request.path === '/v1/cards')
      return { ...marketPage, items: [marketCard, secondCard], total: 2 };
    if (request.path === '/v1/cards/catalog') return marketCatalog;
    return [
      {
        id: 'pack-1',
        name: 'Pack Ouro',
        emoji: 'P',
        cardsAmount: 3,
        price: 50,
        limitPerUser: 2,
      },
    ];
  });

  await using bot = await createMockBot({
    commands: [LojaCommand],
    components: [LojaTabComponent, LojaPackSelectComponent],
  });
  const opened = await bot.slash(LojaCommand);
  bot.reset();
  const market = await bot.clickButton(storeButtonId(opened.messages, 'Contratar'));
  const cardMenu = storeSelectId(market.messages, 'Escolha um jogador para ver e contratar');

  bot.reset();
  const firstDetail = await bot.selectMenu(cardMenu, [marketCard.id]);
  const staleBuy = storeButtonId(firstDetail.messages, 'Contratar');
  bot.reset();
  const secondDetail = await bot.selectMenu(cardMenu, [secondCard.id]);
  assert.match(JSON.stringify(secondDetail.messages), /Centroavante/);

  bot.reset();
  const stale = await bot.clickButton(staleBuy);
  assert.match(messageText(stale.messages[0]), /Jogador não selecionado/);
  assert.equal(api.requests.filter(({ method }) => method === 'POST').length, 0);
});

test('informa falha ao abrir a loja sem vazar o erro da API', async () => {
  const api = mockApi({ message: 'database details' }, 500);

  await using bot = await createMockBot({ commands: [LojaCommand] });
  const result = await bot.slash(LojaCommand);

  assert.equal(result.ephemeral, true);
  assert.match(messageText(result.messages[0]), /Não foi possível concluir \/loja/);
  assert.doesNotMatch(messageText(result.messages[0]), /database details/);
  assert.deepEqual(api.requests, [{ method: 'GET', path: '/v1/packs', body: null }]);
});

test('abre a loja por comando de mensagem', async () => {
  const api = mockApi([
    {
      id: 'pack-1',
      name: 'Pack Ouro',
      emoji: '📦',
      cardsAmount: 3,
      price: 50,
      limitPerUser: 2,
    },
  ]);

  await using bot = await createMockBot({
    commands: [LojaCommand],
    components: [LojaTabComponent],
    prefixes: ['!'],
  });

  const result = await bot.say('!loja');

  assert.match(result.textDisplays.join('\n'), new RegExp(`^## ${EMOJI.loja} Loja de packs`));
  assert.match(JSON.stringify(result.messages), /Escolha um pack para ver e comprar/);
  assert.match(JSON.stringify(result.messages), /Pack Ouro/);
  assert.deepEqual(api.requests, [{ method: 'GET', path: '/v1/packs', body: null }]);
});

test('abre o pack escolhido no select menu', async () => {
  const api = mockApi((request: { readonly path: string }) =>
    request.path === '/v1/packs'
      ? [
          {
            id: 'pack-1',
            name: 'Pack Ouro',
            emoji: '📦',
            cardsAmount: 3,
            price: 50,
            limitPerUser: 2,
          },
        ]
      : {
          id: 'pack-1',
          name: 'Pack Ouro',
          emoji: '<:pk_pack_ouro_ab12cd:300000000000000002>',
          price: 50,
          imageUrl: '',
          cardsPerPack: 3,
        },
  );

  await using bot = await createMockBot({
    commands: [LojaCommand],
    components: [LojaTabComponent, LojaPackSelectComponent],
  });

  const opened = await bot.slash(LojaCommand);
  const select = storeSelectId(opened.messages);
  bot.reset();
  const selected = await bot.selectMenu(select, ['pack-1']);

  const payload = JSON.stringify(selected.edits);
  assert.match(payload, /### <:pk_pack_ouro_ab12cd:300000000000000002> Pack Ouro/);
  assert.match(payload, /"label":"Comprar · 50"/);
  assert.match(payload, /"label":"Voltar à loja"/);
  assert.deepEqual(api.requests, [
    { method: 'GET', path: '/v1/packs', body: null },
    { method: 'GET', path: '/v1/packs/pack-1', body: null },
  ]);
});

test('pagina os packs com controles visíveis e atualiza o select menu', async () => {
  const api = mockApi(
    Array.from({ length: 6 }, (_, index) => ({
      id: `pack-${index + 1}`,
      name: `Pack ${index + 1}`,
      emoji: 'P',
      cardsAmount: 1,
      price: 10,
      limitPerUser: 1,
    })),
  );

  await using bot = await createMockBot({
    commands: [LojaCommand],
    components: [LojaTabComponent],
  });

  const opened = await bot.slash(LojaCommand);
  assert.match(JSON.stringify(opened.messages), /Página 1 de 2/);
  const next = storeButtonId(opened.messages, 'Próxima');
  bot.reset();
  const secondPage = await bot.clickButton(next);
  const payload = JSON.stringify(secondPage.messages);
  assert.match(payload, /Página 2 de 2/);
  assert.match(payload, /Pack 5/);
  assert.match(payload, /Pack 6/);
  assert.doesNotMatch(payload, /Pack 4/);
  assert.match(payload, /Anterior/);
  assert.deepEqual(api.requests, [
    { method: 'GET', path: '/v1/packs', body: null },
    { method: 'GET', path: '/v1/packs', body: null },
  ]);
});

test('nega clique estrangeiro ou adulterado sem atualizar a loja', async () => {
  const api = mockApi([
    {
      id: 'pack-1',
      name: 'Pack Ouro',
      emoji: '📦',
      cardsAmount: 3,
      price: 50,
      limitPerUser: 2,
    },
  ]);

  await using bot = await createMockBot({
    commands: [LojaCommand],
    components: [LojaTabComponent],
  });

  const opened = await bot.slash(LojaCommand);
  const contratar = storeButtonId(opened.messages, 'Contratar');
  const before = storeSessionManager.parse(contratar, '900000000000000005');
  const beforeSize = storeSessionManager.size;
  assert.equal(before.kind, 'owned');

  bot.reset();
  const foreign = await bot.clickButton(contratar, { userId: '900000000000000006' });
  assert.equal(foreign.ephemeral, true);
  assert.match(messageText(foreign.messages[0]), /Este painel não é seu/);
  assert.equal(foreign.edits.length, 0);
  assert.equal(storeSessionManager.size, beforeSize);
  const after = storeSessionManager.parse(contratar, '900000000000000005');
  assert.equal(after.kind, 'owned');
  if (before.kind === 'owned' && after.kind === 'owned') {
    assert.equal(after.session.id.value, before.session.id.value);
    assert.deepEqual(after.session.state, before.session.state);
  }

  const tamperedId = `${contratar.slice(0, -1)}${contratar.endsWith('a') ? 'b' : 'a'}`;
  bot.reset();
  const tampered = await bot.clickButton(tamperedId);
  assert.equal(tampered.ephemeral, true);
  assert.match(messageText(tampered.messages[0]), /Botão inválido/);
  assert.equal(tampered.edits.length, 0);
  assert.deepEqual(api.requests, [{ method: 'GET', path: '/v1/packs', body: null }]);
});

test('nega clique expirado sem atualizar a loja', async () => {
  let now = 1_000_000;
  const dateNow = mock.method(Date, 'now', () => now);
  const api = mockApi([
    {
      id: 'pack-1',
      name: 'Pack Ouro',
      emoji: '📦',
      cardsAmount: 3,
      price: 50,
      limitPerUser: 2,
    },
  ]);

  try {
    await using bot = await createMockBot({
      commands: [LojaCommand],
      components: [LojaTabComponent],
    });

    const opened = await bot.slash(LojaCommand);
    const contratar = storeButtonId(opened.messages, 'Contratar');
    now += 15 * 60_000;
    bot.reset();
    const expired = await bot.clickButton(contratar);

    assert.equal(expired.ephemeral, true);
    assert.match(messageText(expired.messages[0]), /Painel expirado/);
    assert.equal(expired.edits.length, 0);
    assert.deepEqual(api.requests, [{ method: 'GET', path: '/v1/packs', body: null }]);
  } finally {
    dateNow.mock.restore();
  }
});

test('abre direto na contratação com a opção aba', async () => {
  const api = mockApi((request: ApiRequest) =>
    request.path === '/v1/cards/catalog' ? marketCatalog : marketPage,
  );

  await using bot = await createMockBot({ commands: [LojaCommand] });

  const result = await bot.slash(LojaCommand, { options: { aba: 'contratar' } });

  assert.match(storeBody(result.messages), /Mercado de jogadores/);
  assert.deepEqual(
    api.requests.map(({ path }) => path),
    ['/v1/cards', '/v1/cards/catalog'],
  );
});

test('compra pack pelo detalhe, em privado, oferecendo abrir na hora', async () => {
  const pack = {
    id: 'pack-1',
    name: 'Pack Ouro',
    emoji: '📦',
    price: 50,
    imageUrl: '',
    cardsPerPack: 3,
  };
  const api = mockApi((request: ApiRequest) => {
    if (request.path === '/v1/packs')
      return [{ ...pack, emoji: '📦', cardsAmount: 3, limitPerUser: 2 }];
    if (request.path === '/v1/packs/pack-1') return pack;
    if (request.path === '/v1/packs/pack-1/purchase')
      return { quantity: 1, balance: 450, completedMissions: [] };
    return withTemplates({})(request);
  });

  await using bot = await createMockBot({
    commands: [LojaCommand],
    components: [LojaTabComponent, LojaPackSelectComponent],
  });

  const opened = await bot.slash(LojaCommand);
  bot.reset();
  const detail = await bot.selectMenu(storeSelectId(opened.messages), ['pack-1']);
  const buy = messageButtons(detail.edits[0]).find(({ label }) => label === 'Comprar · 50');
  assert.ok(buy);
  bot.reset();
  const bought = await bot.clickButton(buy.customId);

  assert.equal(bought.ephemeral, true);
  const message = bought.edits[0] ?? bought.messages[0];
  assert.match(messageText(message), /Pack Ouro é seu!/);
  assert.ok(messageButtons(message).some(({ label }) => label === 'Abrir agora'));
  assert.deepEqual(
    api.requests.map(({ method, path }) => `${method} ${path}`),
    [
      'GET /v1/packs',
      'GET /v1/packs/pack-1',
      'GET /v1/packs/pack-1',
      'POST /v1/packs/pack-1/purchase',
      'GET /v1/bot-responses/pack.purchase',
    ],
  );
});
