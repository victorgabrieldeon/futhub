import { createCanvas, loadImage } from '@napi-rs/canvas';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';

import { type E2eContext, adminToken, startE2eContext } from '../../../test/e2e/context.js';
import {
  createCardCatalog,
  createFileFixture,
  createTeamFixture,
} from '../../../test/e2e/entities.js';
import type { FilesService } from '../../files/files.service.js';

let context: E2eContext;
let filesServiceClass: typeof FilesService;

const crestUrl = 'https://game-assets.fut.gg/2026/club/9.png';
const salahPhoto =
  'https://ratings-images-prod.pulse.ea.com/FC26/full/player-portraits/p209331.png';
const alissonPhoto =
  'https://ratings-images-prod.pulse.ea.com/FC26/full/player-portraits/p212831.png';
const liverpoolCrest = 'https://drop-assets.ea.com/images/liverpool/l9.png';
const arsenalCrest = 'https://game-assets.fut.gg/2026/club/1.png';
const premierLeagueLogo = 'https://game-assets.fut.gg/2026/league/13.png';
const libertadoresLogo = 'https://game-assets.fut.gg/2026/league/1003.png';
const flamengoCutout = 'https://r2.thesportsdb.com/images/media/player/cutout/pedro.png';

const coreData = {
  rarities: [],
  leagues: [
    { eaId: 13, name: 'Premier League', imageUrl: premierLeagueLogo },
    { eaId: 1003, name: 'CONMEBOL Libertadores', imageUrl: libertadoresLogo },
    { eaId: 2118, name: 'Icons', imageUrl: libertadoresLogo },
    { eaId: 61, name: 'EFL League Two', imageUrl: libertadoresLogo },
  ],
  clubs: [
    {
      eaId: 9,
      name: 'Liverpool',
      leagueEaId: 13,
      isIconClub: false,
      overallRating: 84,
      imageUrl: crestUrl,
    },
    {
      eaId: 1,
      name: 'Arsenal',
      leagueEaId: 13,
      isIconClub: false,
      overallRating: 85,
      imageUrl: arsenalCrest,
    },
    {
      eaId: 1043,
      name: 'Flamengo',
      leagueEaId: 1003,
      isIconClub: false,
      imageUrl: 'https://game-assets.fut.gg/2026/club/1043.png',
    },
    { eaId: 112658, name: 'ICON', leagueEaId: 2118, isIconClub: true, imageUrl: crestUrl },
  ],
};

function stats(values: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, { value, diff: 0 }]),
  );
}

const liverpoolRoster = [
  {
    id: 209331,
    overallRating: 91,
    firstName: 'Mohamed',
    lastName: 'Salah',
    commonName: null,
    avatarUrl: salahPhoto,
    position: { shortLabel: 'RM' },
    alternatePositions: [{ shortLabel: 'RW' }, { shortLabel: 'ST' }],
    team: { label: 'Liverpool', imageUrl: liverpoolCrest },
    stats: stats({ pac: 89, sho: 88, pas: 86, dri: 90, def: 45, ballControl: 90 }),
  },
  {
    id: 212831,
    overallRating: 89,
    firstName: 'Alisson',
    lastName: 'Ramses Becker',
    commonName: 'Alisson',
    avatarUrl: alissonPhoto,
    position: { shortLabel: 'GK' },
    alternatePositions: null,
    team: { label: 'Liverpool', imageUrl: liverpoolCrest },
    // Goalkeeper face stats live in the outfield keys and must be ignored.
    stats: stats({
      pac: 86,
      sho: 85,
      pas: 86,
      dri: 89,
      def: 56,
      gkDiving: 86,
      gkHandling: 85,
      gkPositioning: 90,
      gkReflexes: 89,
      acceleration: 54,
      sprintSpeed: 56,
      finishing: 13,
      shortPassing: 60,
      longPassing: 58,
      dribbling: 27,
      ballControl: 42,
    }),
  },
];

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function png(): Response {
  return new Response(new Uint8Array(createCanvas(8, 8).toBuffer('image/png')), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  });
}

function stubSources(overrides: Record<string, () => Response> = {}) {
  const routes: Record<string, () => Response> = {
    'https://r2.fut.gg/26/manifest.json': () => json({ 'fc-core-data': 'abcdef12' }),
    'https://r2.fut.gg/26/fc-core-data.v1.abcdef12.json': () => json(coreData),
    'https://drop-api.ea.com/rating/ea-sports-fc?team=9': () =>
      json({ items: liverpoolRoster, totalItems: liverpoolRoster.length }),
    'https://drop-api.ea.com/rating/ea-sports-fc?team=1043': () =>
      json({ items: [], totalItems: 0 }),
    'https://www.footylogos.com/data/search-index.json': () =>
      json([
        {
          label: 'Liverpool FC',
          meta: 'Logo · England',
          href: '/logos/liverpool-fc',
          kind: 'logo',
          preview: 'https://assets.footylogos.com/previews/liverpool-fc.webp',
          terms: 'Liverpool England Premier League',
        },
      ]),
    'https://www.footylogos.com/logos/liverpool-fc': () =>
      new Response(
        '<meta property="og:image:alt" content="Liverpool FC logo"><button data-copy-color="#E51C25"></button><button data-copy-color="#00A398"></button><dt>Text on logo</dt><dd>LFC</dd>',
        { status: 200 },
      ),
    [salahPhoto]: png,
    [alissonPhoto]: () => new Response('missing', { status: 404 }),
    ...overrides,
  };
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const team = url.searchParams.get('team');
    const key =
      url.hostname === 'drop-api.ea.com'
        ? `${url.origin}${url.pathname}?team=${team}`
        : url.toString();
    const route = routes[key];
    if (!route) throw new Error(`Unexpected fetch: ${url.toString()}`);
    return route();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function admin(method: 'GET' | 'POST', url: string, payload?: Record<string, unknown>) {
  return context.app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${adminToken}` },
    ...(payload === undefined ? {} : { payload }),
  });
}

beforeAll(async () => {
  context = await startE2eContext();
  // Static loading races the isolated Vite bootstrap for this app module.
  ({ FilesService: filesServiceClass } = await import('../../files/files.service.js'));
}, 300_000);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await context?.close();
});

test('searches FC clubs and previews an EA squad with mapped ratings', async () => {
  stubSources();

  const clubs = await admin('GET', '/v1/admin/cards/squad-import/clubs?q=liver');
  expect(clubs.statusCode, clubs.body).toBe(200);
  expect(clubs.json()).toEqual([
    { id: 9, name: 'Liverpool', league: 'Premier League', imageUrl: crestUrl },
  ]);

  const squad = await admin('GET', '/v1/admin/cards/squad-import/squad?clubId=9');
  expect(squad.statusCode, squad.body).toBe(200);
  expect(squad.json()).toEqual({
    provider: 'EA SPORTS FC',
    estimated: false,
    sourceUrl: 'https://www.ea.com/games/ea-sports-fc/ratings?team=9',
    team: {
      name: 'Liverpool',
      slug: 'liverpool',
      emoji: 'LFC',
      color: '#E51C25',
      colors: ['#E51C25', '#00A398'],
      imageUrl: 'https://assets.footylogos.com/logos/liverpool-fc/liverpool-fc-logo-footylogos.svg',
    },
    crestUrl: liverpoolCrest,
    existingTeam: null,
    players: [
      {
        sourceId: '209331',
        name: 'Mohamed Salah',
        position: 'PD',
        secondaryPositions: ['CA'],
        overall: 91,
        pace: 89,
        finishing: 88,
        passing: 86,
        dribbling: 90,
        control: 90,
        marking: 45,
        attack: 88,
        creation: 88,
        defense: 45,
        photoUrl: salahPhoto,
      },
      {
        sourceId: '212831',
        name: 'Alisson',
        position: 'GOL',
        secondaryPositions: [],
        overall: 89,
        pace: 55,
        finishing: 13,
        passing: 59,
        dribbling: 27,
        control: 42,
        marking: 88,
        attack: 13,
        creation: 43,
        defense: 88,
        photoUrl: alissonPhoto,
      },
    ],
  });
});

test('lists EA leagues and the clubs of a league for bulk imports', async () => {
  stubSources();

  const leagues = await admin('GET', '/v1/admin/cards/squad-import/leagues');
  expect(leagues.statusCode, leagues.body).toBe(200);
  // Icon-only and empty leagues have no squads to import.
  expect(leagues.json()).toEqual([
    { id: 13, name: 'Premier League', imageUrl: premierLeagueLogo, clubCount: 2 },
    { id: 1003, name: 'CONMEBOL Libertadores', imageUrl: libertadoresLogo, clubCount: 1 },
  ]);

  const clubs = await admin('GET', '/v1/admin/cards/squad-import/league-clubs?leagueId=13');
  expect(clubs.statusCode, clubs.body).toBe(200);
  expect(clubs.json()).toEqual([
    { id: 1, name: 'Arsenal', league: 'Premier League', imageUrl: arsenalCrest },
    { id: 9, name: 'Liverpool', league: 'Premier League', imageUrl: crestUrl },
  ]);

  const missing = await admin('GET', '/v1/admin/cards/squad-import/league-clubs?leagueId=999');
  expect(missing.statusCode, missing.body).toBe(404);
});

test('falls back to an estimated TheSportsDB squad for clubs missing from EA ratings', async () => {
  vi.stubEnv('THESPORTSDB_API_KEY', 'premium-key');
  const existing = await createTeamFixture(context.database, {
    name: 'Flamengo',
    slug: 'flamengo-rj',
  });
  stubSources({
    'https://www.thesportsdb.com/api/v1/json/premium-key/searchteams.php?t=Flamengo': () =>
      json({ teams: [{ idTeam: '134287', strTeam: 'Flamengo', strSport: 'Soccer' }] }),
    'https://www.thesportsdb.com/api/v1/json/premium-key/lookup_all_players.php?id=134287': () =>
      json({
        player: [
          {
            idPlayer: '1',
            strPlayer: 'Pedro',
            strTeam: 'Flamengo',
            strSport: 'Soccer',
            strPosition: 'Centre-Forward',
            strCutout: flamengoCutout,
          },
          {
            idPlayer: '2',
            strPlayer: 'Rossi',
            strTeam: 'Flamengo',
            strSport: 'Soccer',
            strPosition: 'Goalkeeper',
            strCutout: 'https://evil.test/rossi.png',
          },
        ],
      }),
  });

  const squad = await admin('GET', '/v1/admin/cards/squad-import/squad?clubId=1043');
  expect(squad.statusCode, squad.body).toBe(200);
  const body = squad.json();
  expect(body).toMatchObject({
    provider: 'TheSportsDB',
    estimated: true,
    sourceUrl: 'https://www.thesportsdb.com/team/134287',
    team: { name: 'Flamengo', slug: 'flamengo', emoji: 'F', color: '#111111', imageUrl: null },
    crestUrl: null,
    existingTeam: { id: existing.id, name: 'Flamengo', slug: 'flamengo-rj', imageUrl: null },
  });
  expect(body.players).toEqual([
    expect.objectContaining({
      name: 'Pedro',
      position: 'CA',
      overall: 72,
      finishing: 75,
      marking: 27,
      photoUrl: flamengoCutout,
    }),
    expect.objectContaining({ name: 'Rossi', position: 'GOL', marking: 72, photoUrl: null }),
  ]);
});

test('imports a squad with team and photos, then updates the same cards by slug', async () => {
  const { collectionId } = await createCardCatalog(context.database, 'squad');
  const [collection] = await context.database.db
    .select({ slug: context.database.schema.collections.slug })
    .from(context.database.schema.collections)
    .where(context.database.eq(context.database.schema.collections.id, collectionId));
  if (!collection) throw new Error('Missing collection.');
  const photoFile = await createFileFixture(context.database, 'generated/salah.png');
  const redrawnFile = await createFileFixture(context.database, 'generated/salah-redrawn.png');
  const crestFile = await createFileFixture(context.database, 'imports/liverpool-crest.png');
  const importedCrest = vi
    .spyOn(filesServiceClass.prototype, 'importImage')
    .mockResolvedValue({ ...crestFile, url: 'https://minio.test/imports/liverpool-crest.png' });
  const readCrest = vi
    .spyOn(filesServiceClass.prototype, 'read')
    .mockResolvedValue(Buffer.from(createCanvas(8, 8).toBuffer('image/png')));
  const cardImages: Buffer[] = [];
  const generated = vi
    .spyOn(filesServiceClass.prototype, 'generated')
    .mockImplementation(async (image) => {
      expect(image.contentType).toBe('image/png');
      cardImages.push(image.buffer);
      const file = cardImages.length === 1 ? photoFile : redrawnFile;
      return { ...file, url: `https://minio.test/${file.objectKey}` };
    });
  stubSources();
  const players = [
    {
      name: 'Mohamed Salah',
      position: 'PD',
      secondaryPositions: ['CA', 'PD'],
      overall: 91,
      pace: 89,
      finishing: 88,
      passing: 86,
      dribbling: 90,
      control: 90,
      marking: 45,
      attack: 88,
      creation: 88,
      defense: 45,
      photoUrl: salahPhoto,
    },
    {
      name: 'Alisson',
      position: 'GOL',
      secondaryPositions: [],
      overall: 89,
      pace: 55,
      finishing: 13,
      passing: 59,
      dribbling: 27,
      control: 42,
      marking: 88,
      attack: 13,
      creation: 43,
      defense: 88,
      photoUrl: alissonPhoto,
    },
  ];
  const team = {
    name: 'Liverpool',
    slug: 'liverpool',
    emoji: 'LFC',
    color: '#E51C25',
    colors: ['#E51C25', '#00A398'],
    imageUrl: null,
  };

  const created = await admin('POST', '/v1/admin/cards/squad-import', {
    collectionId,
    teamId: null,
    team,
    players,
    crestUrl: liverpoolCrest,
  });
  expect(created.statusCode, created.body).toBe(200);
  const result = created.json();
  expect(result).toEqual({
    teamId: expect.any(String),
    createCount: 2,
    updateCount: 0,
    photoCount: 1,
    photoErrors: 1,
  });

  const [savedTeam] = await context.database.db
    .select()
    .from(context.database.schema.teams)
    .where(context.database.eq(context.database.schema.teams.id, result.teamId));
  // FootyLogos found no badge, so the EA crest becomes the team logo drawn on the cards.
  expect(savedTeam).toMatchObject({
    slug: 'liverpool',
    name: 'Liverpool',
    emoji: 'LFC',
    logoFileId: crestFile.id,
  });
  expect(importedCrest).toHaveBeenCalledWith(liverpoolCrest, 'image/png');
  expect(readCrest).toHaveBeenCalledWith(crestFile.id);
  const salahSlug = `mohamed-salah-liverpool-${collection.slug}`;
  const [salah] = await context.database.db
    .select()
    .from(context.database.schema.cards)
    .where(context.database.eq(context.database.schema.cards.slug, salahSlug));
  expect(salah).toMatchObject({
    name: 'Mohamed Salah',
    teamId: result.teamId,
    collectionId,
    position: 'PD',
    overall: 91,
    attack: 88,
    imageFileId: photoFile.id,
  });
  if (!salah) throw new Error('Missing imported card.');
  const [salahStats] = await context.database.db
    .select()
    .from(context.database.schema.cardStats)
    .where(context.database.eq(context.database.schema.cardStats.id, salah.statsId));
  expect(salahStats).toMatchObject({ pace: 89, finishing: 88, marking: 45, control: 90 });
  const secondary = await context.database.db
    .select({ position: context.database.schema.cardSecondaryPositions.position })
    .from(context.database.schema.cardSecondaryPositions)
    .where(context.database.eq(context.database.schema.cardSecondaryPositions.cardId, salah.id));
  expect(secondary).toEqual([{ position: 'CA' }]);
  const [alisson] = await context.database.db
    .select({ imageFileId: context.database.schema.cards.imageFileId })
    .from(context.database.schema.cards)
    .where(
      context.database.eq(
        context.database.schema.cards.slug,
        `alisson-liverpool-${collection.slug}`,
      ),
    );
  expect(alisson).toEqual({ imageFileId: null });
  // The stored file is the finished 3:4 card art, not the square source portrait.
  const cardArt = await loadImage(cardImages[0] ?? Buffer.alloc(0));
  expect({ width: cardArt.width, height: cardArt.height }).toEqual({ width: 600, height: 800 });

  const updated = await admin('POST', '/v1/admin/cards/squad-import', {
    collectionId,
    teamId: result.teamId,
    team,
    players: [{ ...players[0], overall: 93, pace: 91 }],
  });
  expect(updated.statusCode, updated.body).toBe(200);
  expect(updated.json()).toEqual({
    teamId: result.teamId,
    createCount: 0,
    updateCount: 1,
    photoCount: 0,
    photoErrors: 0,
  });
  const [refreshed] = await context.database.db
    .select({
      overall: context.database.schema.cards.overall,
      imageFileId: context.database.schema.cards.imageFileId,
    })
    .from(context.database.schema.cards)
    .where(context.database.eq(context.database.schema.cards.id, salah.id));
  expect(refreshed).toEqual({ overall: 93, imageFileId: photoFile.id });
  expect(generated).toHaveBeenCalledTimes(1);

  const redrawn = await admin('POST', '/v1/admin/cards/squad-import', {
    collectionId,
    teamId: result.teamId,
    team,
    players: [{ ...players[0], overall: 93, pace: 91 }],
    replaceImages: true,
  });
  expect(redrawn.statusCode, redrawn.body).toBe(200);
  expect(redrawn.json()).toMatchObject({ updateCount: 1, photoCount: 1, photoErrors: 0 });
  const [redrawnCard] = await context.database.db
    .select({ imageFileId: context.database.schema.cards.imageFileId })
    .from(context.database.schema.cards)
    .where(context.database.eq(context.database.schema.cards.id, salah.id));
  expect(redrawnCard).toEqual({ imageFileId: redrawnFile.id });
  const replacedFiles = await context.database.db
    .select({ id: context.database.schema.files.id })
    .from(context.database.schema.files)
    .where(context.database.eq(context.database.schema.files.id, photoFile.id));
  expect(replacedFiles).toEqual([]);
  expect(generated).toHaveBeenCalledTimes(2);
  const teams = await context.database.db
    .select({ id: context.database.schema.teams.id })
    .from(context.database.schema.teams)
    .where(context.database.eq(context.database.schema.teams.slug, 'liverpool'));
  expect(teams).toHaveLength(1);
});

test('rejects players outside the catalog overall range without creating the team', async () => {
  const { collectionId } = await createCardCatalog(context.database, 'squad-invalid');
  stubSources();

  const response = await admin('POST', '/v1/admin/cards/squad-import', {
    collectionId,
    teamId: null,
    team: { name: 'Youth XI', slug: 'youth-xi', emoji: 'YXI', color: '#000000' },
    players: [
      {
        name: 'Prospect',
        position: 'CA',
        overall: 55,
        pace: 60,
        finishing: 55,
        passing: 50,
        dribbling: 55,
        control: 55,
        marking: 20,
        attack: 55,
        creation: 50,
        defense: 20,
        photoUrl: null,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(400);
  const teams = await context.database.db
    .select({ id: context.database.schema.teams.id })
    .from(context.database.schema.teams)
    .where(context.database.eq(context.database.schema.teams.slug, 'youth-xi'));
  expect(teams).toEqual([]);
});
