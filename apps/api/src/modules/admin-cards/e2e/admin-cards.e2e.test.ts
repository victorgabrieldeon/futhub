import { randomUUID } from 'node:crypto';

import ExcelJS from 'exceljs';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { type E2eContext, adminToken, startE2eContext } from '../../../test/e2e/context.js';
import { createPackFixture } from '../../../test/e2e/entities.js';
import { FilesService } from '../../files/files.service.js';

let context: E2eContext;

const importHeaders: Record<string, string> = {
  slug: 'Código único',
  name: 'Nome do jogador',
  collection: 'Coleção',
  team: 'Time',
  position: 'Posição principal',
  secondaryPositions: 'Posições secundárias',
  contractsBlocked: 'Bloquear contratos?',
  defense: 'Defesa',
  attack: 'Ataque',
  creation: 'Criação',
  overall: 'Overall',
  passing: 'Passe',
  control: 'Controle',
  marking: 'Marcação',
  pace: 'Ritmo',
  dribbling: 'Drible',
  finishing: 'Finalização',
};

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('suggests matching FootyLogos badges', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            label: 'Flamengo (CRF)',
            meta: 'Logo · Brazil',
            href: '/logos/flamengo',
            kind: 'logo',
            preview:
              'https://assets.footylogos.com/previews/flamengo/flamengo-logo-footylogos-320.webp',
            terms: 'Flamengo Brazil Brasileirão Série A',
          },
          {
            label: 'Flamengo impostor',
            meta: 'Logo · Brazil',
            href: 'https://invalid.test/logos/flamengo',
            kind: 'logo',
            preview: 'https://invalid.test/flamengo.webp',
            terms: 'Flamengo Brazil',
          },
        ]),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        '<meta property="og:image:alt" content="Flamengo (CRF) logo"><div class="metadata-logo-colors"><button data-copy-color="#C52613"></button><button data-copy-color="#000200"></button><button data-copy-color="#FFFFFF"></button></div><dt>Text on logo</dt><dd>CRF</dd>',
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new Response('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z"/></svg>', {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      }),
    );
  vi.stubGlobal('fetch', fetchMock);
  try {
    const response = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/team-logo-suggestions?q=Flamengo',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual([
      {
        name: 'Flamengo (CRF)',
        slug: 'flamengo',
        description: 'Logo · Brazil',
        imageUrl: 'https://assets.footylogos.com/logos/flamengo/flamengo-logo-footylogos.svg',
        sourceUrl: 'https://www.footylogos.com/logos/flamengo',
      },
    ]);
    const details = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/team-logo-details?slug=flamengo',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(details.statusCode, details.body).toBe(200);
    expect(details.json()).toEqual({
      name: 'Flamengo (CRF)',
      slug: 'flamengo',
      symbol: 'CRF',
      colors: ['#C52613', '#000200', '#FFFFFF'],
      imageUrl: 'https://assets.footylogos.com/logos/flamengo/flamengo-logo-footylogos.svg',
      sourceUrl: 'https://www.footylogos.com/logos/flamengo',
    });
    const logo = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/team-logos/flamengo.svg',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(logo.statusCode, logo.body).toBe(200);
    expect(logo.headers['content-type']).toBe('image/svg+xml');
    expect(logo.body).toContain('<svg');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const invalidLogo = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/team-logos/flamengo.png',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(invalidLogo.statusCode, invalidLogo.body).toBe(400);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('uses team initials when FootyLogos text exceeds the catalog limit', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(
        '<meta property="og:image:alt" content="Inter Miami logo"><dt>Text on logo</dt><dd>Club Internacional de Fútbol, Miami, MMXX</dd>',
        { status: 200 },
      ),
    );
  vi.stubGlobal('fetch', fetchMock);
  try {
    const response = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/team-logo-details?slug=inter-miami',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      name: 'Inter Miami',
      slug: 'inter-miami',
      symbol: 'IM',
      colors: [],
      imageUrl: 'https://assets.footylogos.com/logos/inter-miami/inter-miami-logo-footylogos.svg',
      sourceUrl: 'https://www.footylogos.com/logos/inter-miami',
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

test('lists and searches FUT.GG collection artwork and identity', async () => {
  const fetchMock = vi.fn(async (input: URL) => {
    const url = new URL(input);
    if (url.pathname === '/26/manifest.json') {
      return new Response(JSON.stringify({ 'fc-core-data': 'a1b2c3d4' }), { status: 200 });
    }
    if (url.pathname === '/26/fc-core-data.v1.a1b2c3d4.json') {
      return new Response(
        JSON.stringify({
          rarities: [
            {
              name: 'Team of the Year',
              slug: 'team-of-the-year',
              dominantColor: '161a4f',
              textColor: ['f5db9b'],
              imageUrl:
                'https://game-assets.fut.gg/cdn-cgi/image/quality=85/2026/rarities-level-0-large/5.abc.png',
              compactImageUrl:
                'https://game-assets.fut.gg/cdn-cgi/image/quality=85/2026/rarities-level-0-small/5.abc.png',
              rarityGroupName: 'Team of the Year',
            },
            {
              name: 'Invalid artwork host',
              slug: 'invalid-artwork-host',
              dominantColor: '000000',
              textColor: ['ffffff'],
              imageUrl: 'https://invalid.test/card.png',
              compactImageUrl: 'https://invalid.test/card-small.png',
              rarityGroupName: null,
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  try {
    const catalogResponse = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/collection-artwork-suggestions?q=',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(catalogResponse.statusCode, catalogResponse.body).toBe(200);
    expect(catalogResponse.json()).toEqual([
      {
        name: 'Team of the Year',
        slug: 'team-of-the-year',
        symbol: 'TY',
        primaryColor: '#161A4F',
        secondaryColor: '#F5DB9B',
        imageUrl:
          'https://game-assets.fut.gg/cdn-cgi/image/quality=85/2026/rarities-level-0-small/5.abc.png',
        overlayUrl:
          'https://game-assets.fut.gg/cdn-cgi/image/quality=85/2026/rarities-level-0-large/5.abc.png',
        bannerUrl:
          'https://game-assets.fut.gg/cdn-cgi/image/quality=85/2026/rarities-level-0-large/5.abc.png',
        description: 'Team of the Year · FC 26',
        sourceUrl: 'https://www.fut.gg/rarities/team-of-the-year/',
      },
    ]);
    const shortQueryResponse = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/collection-artwork-suggestions?q=t',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(shortQueryResponse.statusCode, shortQueryResponse.body).toBe(200);
    expect(shortQueryResponse.json()).toEqual(catalogResponse.json());
    const response = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/collection-artwork-suggestions?q=team%20of%20the%20year',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual(catalogResponse.json());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('suggests TheSportsDB renders and photos', async () => {
  const fetchMock = vi.fn(async (input: URL) => {
    const url = new URL(input);
    if (url.hostname === 'www.thesportsdb.com' && url.pathname.endsWith('searchplayers.php')) {
      return new Response(
        JSON.stringify({
          player: [
            {
              idPlayer: '34146370',
              strPlayer: 'Lionel Messi',
              strTeam: 'Inter Miami',
              strSport: 'Soccer',
              strCutout:
                'https://r2.thesportsdb.com/images/media/player/cutout/e0i2051750317027.png',
              strPosition: 'Right Winger',
            },
            {
              idPlayer: '34146371',
              strPlayer: 'Second Player',
              strTeam: 'Another Club',
              strSport: 'Soccer',
              strCutout: 'https://r2.thesportsdb.com/images/media/player/cutout/second-cutout.png',
              strPosition: 'Centre-Back',
            },
            {
              idPlayer: 'invalid',
              strPlayer: 'Invalid asset',
              strTeam: null,
              strSport: 'Soccer',
              strCutout: 'https://invalid.test/player.jpg',
              strPosition: null,
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.hostname === 'www.thesportsdb.com' && url.pathname.endsWith('lookupplayer.php')) {
      const id = url.searchParams.get('id');
      expect(['34146370', '34146371']).toContain(id);
      const player =
        id === '34146370'
          ? {
              idPlayer: '34146370',
              strPlayer: 'Lionel Messi',
              strTeam: 'Inter Miami',
              strSport: 'Soccer',
              strCutout:
                'https://r2.thesportsdb.com/images/media/player/cutout/e0i2051750317027.png',
              strRender: 'https://r2.thesportsdb.com/images/media/player/render/messi-render.png',
              strPoster: 'https://r2.thesportsdb.com/images/media/player/poster/messi-poster.jpg',
              strThumb: 'https://r2.thesportsdb.com/images/media/player/thumb/messi-thumb.jpg',
              strCartoon:
                'https://r2.thesportsdb.com/images/media/player/cartoon/messi-cartoon.png',
              strPosition: 'Right Winger',
            }
          : {
              idPlayer: '34146371',
              strPlayer: 'Second Player',
              strTeam: 'Another Club',
              strSport: 'Soccer',
              strCutout: 'https://r2.thesportsdb.com/images/media/player/cutout/second-cutout.png',
              strRender: 'https://r2.thesportsdb.com/images/media/player/render/second-render.png',
              strPosition: 'Centre-Back',
            };
      return new Response(JSON.stringify({ players: [player] }), { status: 200 });
    }
    if (url.hostname === 'r2.thesportsdb.com') {
      const jpeg = url.pathname.endsWith('.jpg');
      return new Response(
        Uint8Array.from(jpeg ? [255, 216, 255] : [137, 80, 78, 71, 13, 10, 26, 10]),
        {
          status: 200,
          headers: { 'content-type': jpeg ? 'image/jpeg' : 'image/png' },
        },
      );
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  try {
    const response = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/player-photo-suggestions?q=Lionel%20Messi',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual([
      {
        id: '34146370-cutout',
        name: 'Lionel Messi',
        team: 'Inter Miami',
        position: 'Right Winger',
        imageUrl: '/v1/admin/cards/player-photos/e0i2051750317027.png',
        sourceUrl: 'https://www.thesportsdb.com/player/34146370',
        provider: 'TheSportsDB',
      },
      {
        id: '34146370-render',
        name: 'Lionel Messi',
        team: 'Inter Miami',
        position: 'Right Winger',
        imageUrl: '/v1/admin/cards/player-photos/render/messi-render.png',
        sourceUrl: 'https://www.thesportsdb.com/player/34146370',
        provider: 'TheSportsDB',
      },
      {
        id: '34146370-cartoon',
        name: 'Lionel Messi',
        team: 'Inter Miami',
        position: 'Right Winger',
        imageUrl: '/v1/admin/cards/player-photos/cartoon/messi-cartoon.png',
        sourceUrl: 'https://www.thesportsdb.com/player/34146370',
        provider: 'TheSportsDB',
      },
      {
        id: '34146371-cutout',
        name: 'Second Player',
        team: 'Another Club',
        position: 'Centre-Back',
        imageUrl: '/v1/admin/cards/player-photos/second-cutout.png',
        sourceUrl: 'https://www.thesportsdb.com/player/34146371',
        provider: 'TheSportsDB',
      },
      {
        id: '34146371-render',
        name: 'Second Player',
        team: 'Another Club',
        position: 'Centre-Back',
        imageUrl: '/v1/admin/cards/player-photos/render/second-render.png',
        sourceUrl: 'https://www.thesportsdb.com/player/34146371',
        provider: 'TheSportsDB',
      },
      {
        id: '34146370-poster',
        name: 'Lionel Messi',
        team: 'Inter Miami',
        position: 'Right Winger',
        imageUrl: '/v1/admin/cards/player-photos/poster/messi-poster.jpg',
        sourceUrl: 'https://www.thesportsdb.com/player/34146370',
        provider: 'TheSportsDB',
      },
      {
        id: '34146370-thumb',
        name: 'Lionel Messi',
        team: 'Inter Miami',
        position: 'Right Winger',
        imageUrl: '/v1/admin/cards/player-photos/thumb/messi-thumb.jpg',
        sourceUrl: 'https://www.thesportsdb.com/player/34146370',
        provider: 'TheSportsDB',
      },
    ]);
    const render = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/player-photos/render/messi-render.png',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(render.statusCode, render.body).toBe(200);
    expect(render.headers['content-type']).toBe('image/png');
    expect(render.rawPayload).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const poster = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/cards/player-photos/poster/messi-poster.jpg',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(poster.statusCode, poster.body).toBe(200);
    expect(poster.headers['content-type']).toBe('image/jpeg');
    expect(poster.rawPayload).toEqual(Buffer.from([255, 216, 255]));
    expect(fetchMock).toHaveBeenCalledTimes(5);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('imports cards atomically and updates them by slug', async () => {
  const { cardId } = await createPackFixture(context.database);
  const [source] = await context.database.db
    .select()
    .from(context.database.schema.cards)
    .where(context.database.eq(context.database.schema.cards.id, cardId));
  if (!source) throw new Error('Missing source card.');
  const [collection] = await context.database.db
    .select({ nameTextId: context.database.schema.collections.nameTextId })
    .from(context.database.schema.collections)
    .where(context.database.eq(context.database.schema.collections.id, source.collectionId));
  const [team] = await context.database.db
    .select({ name: context.database.schema.teams.name })
    .from(context.database.schema.teams)
    .where(context.database.eq(context.database.schema.teams.id, source.teamId));
  if (!collection || !team) throw new Error('Missing card catalog.');
  const [collectionName] = await context.database.db
    .select({ name: context.database.schema.localizedTextTranslations.content })
    .from(context.database.schema.localizedTextTranslations)
    .where(
      context.database.eq(
        context.database.schema.localizedTextTranslations.localizedTextId,
        collection.nameTextId,
      ),
    );
  if (!collectionName) throw new Error('Missing collection name.');
  const body = await workbook({
    slug: 'serie-a-001',
    name: 'Imported',
    collection: collectionName.name,
    team: team.name,
    position: 'CA',
    secondaryPositions: 'MC;MA',
    contractsBlocked: 'Não',
    defense: '70',
    attack: '91',
    creation: '85',
    overall: '88',
    passing: '84',
    control: '85',
    marking: '50',
    pace: '88',
    dribbling: '90',
    finishing: '93',
  });
  const preview = await request('preview', body);
  expect(preview.statusCode).toBe(200);
  expect(preview.json()).toMatchObject({ valid: true, createCount: 1, updateCount: 0 });

  const imported = await request('import', body);
  expect(imported.statusCode).toBe(200);
  const [card] = await context.database.db
    .select()
    .from(context.database.schema.cards)
    .where(context.database.eq(context.database.schema.cards.slug, 'serie-a-001'));
  expect(card).toMatchObject({ slug: 'serie-a-001', name: 'Imported', overall: 88, attack: 91 });
  if (!card) throw new Error('Imported card is missing.');
  const [stats] = await context.database.db
    .select()
    .from(context.database.schema.cardStats)
    .where(context.database.eq(context.database.schema.cardStats.id, card.statsId));
  expect(stats).toMatchObject({ passing: 84, finishing: 93 });
  const secondary = await context.database.db
    .select()
    .from(context.database.schema.cardSecondaryPositions)
    .where(context.database.eq(context.database.schema.cardSecondaryPositions.cardId, card.id));
  expect(secondary.map((position) => position.position).sort()).toEqual(['MA', 'MC']);

  const updated = await workbook({
    ...(await values(body)),
    name: 'Updated',
    overall: '89',
  });
  const update = await request('import', updated);
  expect(update.statusCode).toBe(200);
  expect(update.json()).toMatchObject({ createCount: 0, updateCount: 1 });
  const cards = await context.database.db
    .select()
    .from(context.database.schema.cards)
    .where(context.database.eq(context.database.schema.cards.slug, 'serie-a-001'));
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({ name: 'Updated', overall: 89 });
  const storedCard = cards[0];
  if (!storedCard) throw new Error('Imported card was not persisted.');
  const files = await context.database.db
    .insert(context.database.schema.files)
    .values([
      {
        objectKey: `cards/${storedCard.id}/image.png`,
        contentType: 'image/png',
        sizeBytes: 1,
        source: 'upload',
        metadata: {},
      },
      {
        objectKey: `collections/${source.collectionId}/image.png`,
        contentType: 'image/png',
        sizeBytes: 1,
        source: 'upload',
        metadata: {},
      },
      {
        objectKey: `teams/${source.teamId}/logo.png`,
        contentType: 'image/png',
        sizeBytes: 1,
        source: 'upload',
        metadata: {},
      },
    ])
    .returning({
      id: context.database.schema.files.id,
      objectKey: context.database.schema.files.objectKey,
    });
  const cardImage = files.find((file) => file.objectKey.startsWith('cards/'));
  const collectionImage = files.find((file) => file.objectKey.startsWith('collections/'));
  const teamImage = files.find((file) => file.objectKey.startsWith('teams/'));
  if (!cardImage || !collectionImage || !teamImage)
    throw new Error('Failed to create image fixtures.');
  const urls = vi.spyOn(FilesService.prototype, 'urls').mockResolvedValue(
    new Map([
      [cardImage.id, 'https://images.test/player.png'],
      [collectionImage.id, 'https://images.test/collection.png'],
      [teamImage.id, 'https://images.test/team.png'],
    ]),
  );
  await Promise.all([
    context.database.db
      .update(context.database.schema.cards)
      .set({ imageFileId: cardImage.id })
      .where(context.database.eq(context.database.schema.cards.id, storedCard.id)),
    context.database.db
      .update(context.database.schema.collections)
      .set({ imageFileId: collectionImage.id })
      .where(context.database.eq(context.database.schema.collections.id, source.collectionId)),
    context.database.db
      .update(context.database.schema.teams)
      .set({ logoFileId: teamImage.id })
      .where(context.database.eq(context.database.schema.teams.id, source.teamId)),
  ]);
  try {
    const listed = await context.app.inject({
      method: 'GET',
      url: `/v1/admin/cards?page=1&query=Updated&teamId=${source.teamId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listed.statusCode, listed.body).toBe(200);
    expect(listed.json()).toMatchObject({
      total: 1,
      items: [
        {
          name: 'Updated',
          imageUrl: 'https://images.test/player.png',
          collection: { emoji: '⚽', imageUrl: 'https://images.test/collection.png' },
          team: { emoji: '⚽', imageUrl: 'https://images.test/team.png' },
          passing: 84,
          control: 85,
          marking: 50,
          pace: 88,
          dribbling: 90,
          finishing: 93,
        },
      ],
    });
  } finally {
    urls.mockRestore();
  }
});

test('exports a Portuguese workbook with safe catalog choices', async () => {
  await createPackFixture(context.database);
  const response = await context.app.inject({
    method: 'GET',
    url: '/v1/admin/cards/template',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(response.statusCode, response.body).toBe(200);

  const template = response.json() as { content: string };
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(template.content, 'base64') as never);
  const cards = book.getWorksheet('Cards');
  const references = book.getWorksheet('Referências');
  const options = book.getWorksheet('Opções');
  if (!cards || !references || !options) throw new Error('Template worksheets are missing.');

  expect(cards.getCell(1, 1).text).toBe('Código único');
  expect(cards.getCell(1, 7).text).toBe('Bloquear contratos?');
  expect(cards.getCell(2, 7).text).toBe('Não');
  expect(cards.getCell(2, 5).dataValidation).toMatchObject({
    type: 'list',
    formulae: ["'Opções'!$A$2:$A$11"],
  });
  expect(cards.getCell(2, 7).dataValidation).toMatchObject({
    type: 'list',
    formulae: ["'Opções'!$B$2:$B$3"],
  });
  expect(cards.getCell(2, 3).dataValidation.type).toBe('list');
  expect(cards.getCell(2, 4).dataValidation.type).toBe('list');
  expect(references.getCell(1, 1).text).toBe('Coleções disponíveis');
  expect(references.getCell(1, 2).text).toBe('Times disponíveis');
  expect(options.state).toBe('hidden');
});

test('filters and sorts cards', async () => {
  const { cardId } = await createPackFixture(context.database);
  const [source] = await context.database.db
    .select()
    .from(context.database.schema.cards)
    .where(context.database.eq(context.database.schema.cards.id, cardId));
  if (!source) throw new Error('Missing source card.');

  const suffix = randomUUID();
  const cards = await Promise.all(
    [
      { name: `Filter high ${suffix}`, overall: 99 },
      { name: `Filter low ${suffix}`, overall: 80 },
    ].map(async (card) => {
      const [statistics] = await context.database.db
        .insert(context.database.schema.cardStats)
        .values({ passing: 80, control: 80, marking: 80, pace: 80, dribbling: 80, finishing: 80 })
        .returning({ id: context.database.schema.cardStats.id });
      if (!statistics) throw new Error('Missing card statistics.');
      const [created] = await context.database.db
        .insert(context.database.schema.cards)
        .values({
          slug: `${card.overall}-${suffix}`,
          name: card.name,
          collectionId: source.collectionId,
          teamId: source.teamId,
          position: 'CA',
          statsId: statistics.id,
          imageUrl: 'https://images.test/player.png',
          defense: 80,
          attack: 80,
          creation: 80,
          overall: card.overall,
        })
        .returning({ id: context.database.schema.cards.id });
      if (!created) throw new Error('Missing test card.');
      return created;
    }),
  );
  expect(cards).toHaveLength(2);

  const defaultImage = vi.spyOn(FilesService.prototype, 'defaultCardImage').mockResolvedValue({
    id: 'default-card-image',
    url: 'https://images.test/default.webp',
    contentType: 'image/webp',
    sizeBytes: 1,
    width: null,
    height: null,
  });
  try {
    const response = await context.app.inject({
      method: 'GET',
      url: `/v1/admin/cards?page=1&query=${suffix}&teamId=${source.teamId}&position=CA&sort=overall`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      total: 2,
      items: [
        { name: `Filter high ${suffix}`, overall: 99 },
        { name: `Filter low ${suffix}`, overall: 80 },
      ],
    });
  } finally {
    defaultImage.mockRestore();
  }
});

test('rejects workbook with errors without persisting valid rows', async () => {
  const countBefore = await countCards();
  const body = await workbook({
    slug: 'invalid-001',
    name: 'Invalid',
    collection: 'missing collection',
    team: 'missing team',
    position: 'CA',
    secondaryPositions: '',
    contractsBlocked: 'Não',
    defense: '70',
    attack: '91',
    creation: '85',
    overall: '88',
    passing: '84',
    control: '85',
    marking: '50',
    pace: '88',
    dribbling: '90',
    finishing: '93',
  });
  const response = await request('import', body);
  expect(response.statusCode).toBe(400);
  expect(await countCards()).toBe(countBefore);
});

test('manages paginated collections and teams', async () => {
  const suffix = randomUUID();
  const collection = await catalogRequest('POST', 'collections', {
    name: `Collection ${suffix}`,
    slug: `collection-${suffix}`,
    emoji: '⚽',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
  });
  expect(collection.statusCode).toBe(201);
  const createdCollection = collection.json();
  expect(createdCollection).toMatchObject({
    name: `Collection ${suffix}`,
    contractsBlocked: false,
  });

  const collections = await catalogRequest('GET', 'collections?page=1&pageSize=1');
  expect(collections.statusCode).toBe(200);
  expect(collections.json()).toMatchObject({ page: 1, pageSize: 1 });
  expect(collections.json().total).toBeGreaterThanOrEqual(1);
  expect(collections.json().items).toHaveLength(1);
  expect(collections.json().items[0]?.id).toBe(createdCollection.id);

  const updatedCollection = await catalogRequest('PUT', `collections/${createdCollection.id}`, {
    name: `Updated collection ${suffix}`,
    slug: `updated-collection-${suffix}`,
    emoji: '🏆',
    primaryColor: '#111111',
    secondaryColor: '#eeeeee',
    contractsBlocked: true,
  });
  expect(updatedCollection.statusCode).toBe(200);
  expect(updatedCollection.json()).toMatchObject({
    id: createdCollection.id,
    name: `Updated collection ${suffix}`,
    contractsBlocked: true,
  });
  const [storedCollection] = await context.database.db
    .select({
      contractsBlocked: context.database.schema.collections.contractsBlocked,
      slug: context.database.schema.collections.slug,
    })
    .from(context.database.schema.collections)
    .where(context.database.eq(context.database.schema.collections.id, createdCollection.id));
  expect(storedCollection).toEqual({
    contractsBlocked: true,
    slug: `updated-collection-${suffix}`,
  });
  const filteredCollections = await catalogRequest(
    'GET',
    `collections?page=1&query=updated-collection-${suffix}&contractsBlocked=true`,
  );
  expect(filteredCollections.statusCode, filteredCollections.body).toBe(200);
  expect(filteredCollections.json()).toMatchObject({
    total: 1,
    items: [{ id: createdCollection.id, contractsBlocked: true }],
  });

  const team = await catalogRequest('POST', 'teams', {
    name: `Team ${suffix}`,
    slug: `team-${suffix}`,
    emoji: '⚽',
    color: '#000000',
    colors: ['#000000', '#FFFFFF'],
  });
  expect(team.statusCode).toBe(201);
  const createdTeam = team.json();
  expect(createdTeam.colors).toEqual(['#000000', '#FFFFFF']);
  const rejectedTeam = await catalogRequest('POST', 'teams', {
    name: `Invalid team ${suffix}`,
    slug: `invalid-team-${suffix}`,
    emoji: 'X',
    color: '#000000',
    imageUrl: 'https://example.com/team.png',
  });
  expect(rejectedTeam.statusCode).toBe(400);

  const teams = await catalogRequest('GET', 'teams?page=1&pageSize=1');
  expect(teams.statusCode).toBe(200);
  expect(teams.json()).toMatchObject({ page: 1, pageSize: 1 });
  expect(teams.json().total).toBeGreaterThanOrEqual(1);
  expect(teams.json().items).toHaveLength(1);
  expect(teams.json().items[0]?.id).toBe(createdTeam.id);

  const updatedTeam = await catalogRequest('PUT', `teams/${createdTeam.id}`, {
    name: `Updated team ${suffix}`,
    slug: `updated-team-${suffix}`,
    emoji: '🏟️',
    color: '#ffffff',
  });
  expect(updatedTeam.statusCode).toBe(200);
  expect(updatedTeam.json()).toMatchObject({ id: createdTeam.id, name: `Updated team ${suffix}` });
  const [storedTeam] = await context.database.db
    .select({
      color: context.database.schema.teams.color,
      colors: context.database.schema.teams.colors,
      slug: context.database.schema.teams.slug,
    })
    .from(context.database.schema.teams)
    .where(context.database.eq(context.database.schema.teams.id, createdTeam.id));
  expect(storedTeam).toEqual({
    color: '#ffffff',
    colors: ['#ffffff'],
    slug: `updated-team-${suffix}`,
  });
  const filteredTeams = await catalogRequest(
    'GET',
    `teams?page=1&query=updated-team-${suffix}&image=default`,
  );
  expect(filteredTeams.statusCode, filteredTeams.body).toBe(200);
  expect(filteredTeams.json()).toMatchObject({
    total: 1,
    items: [{ id: createdTeam.id, imageUrl: null }],
  });

  expect((await catalogRequest('DELETE', `collections/${createdCollection.id}`)).statusCode).toBe(
    204,
  );
  expect((await catalogRequest('DELETE', `teams/${createdTeam.id}`)).statusCode).toBe(204);
  const [deletedCollection, deletedTeam] = await Promise.all([
    context.database.db
      .select({ id: context.database.schema.collections.id })
      .from(context.database.schema.collections)
      .where(context.database.eq(context.database.schema.collections.id, createdCollection.id)),
    context.database.db
      .select({ id: context.database.schema.teams.id })
      .from(context.database.schema.teams)
      .where(context.database.eq(context.database.schema.teams.id, createdTeam.id)),
  ]);
  expect(deletedCollection).toHaveLength(0);
  expect(deletedTeam).toHaveLength(0);
});

async function countCards(): Promise<number> {
  const [result] = await context.database.db
    .select({ count: context.database.sql<number>`count(*)::int` })
    .from(context.database.schema.cards);
  return result?.count ?? 0;
}

async function workbook(row: Record<string, string>): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Cards');
  const fields = Object.keys(row);
  sheet.addRow(fields.map((field) => importHeaders[field] ?? field));
  sheet.addRow(fields.map((field) => row[field]));
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function values(body: Buffer): Promise<Record<string, string>> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(body as never);
  const sheet = book.getWorksheet('Cards');
  if (!sheet) throw new Error('Missing Cards worksheet.');
  const importKeysByHeader = Object.fromEntries(
    Object.entries(importHeaders).map(([key, header]) => [header, key]),
  ) as Record<string, string>;
  return Object.fromEntries(
    Array.from({ length: sheet.getRow(1).cellCount }, (_, index) => {
      const header = sheet.getRow(1).getCell(index + 1).text;
      return [importKeysByHeader[header] ?? header, sheet.getRow(2).getCell(index + 1).text];
    }),
  );
}

function catalogRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  payload?: Record<string, unknown>,
) {
  return context.app.inject({
    method,
    url: path ? `/v1/admin/cards/${path}` : '/v1/admin/cards',
    headers: {
      authorization: `Bearer ${adminToken}`,
      ...(payload ? { 'content-type': 'application/json' } : {}),
    },
    payload: payload ? JSON.stringify(payload) : undefined,
  });
}

function request(path: string, file: Buffer) {
  const boundary = '----futhub-card-import';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="cards.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return context.app.inject({
    method: 'POST',
    url: `/v1/admin/cards/${path}`,
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
}
