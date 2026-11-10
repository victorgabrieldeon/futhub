import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { EntityEmojisService } from '../bot-emojis/entity-emojis.service.js';
import { type FileDto, FilesService, imageFile } from '../files/files.service.js';
import { renderTeamCardImage } from '../team/team-card-image.js';
import type {
  CardReference,
  SquadImportClub,
  SquadImportInput,
  SquadImportLeague,
  SquadImportPlayer,
  SquadImportPreview,
  SquadImportPreviewPlayer,
  SquadImportResult,
  SquadImportSquadQuery,
  TeamInput,
} from './admin-cards.dto.js';
import { AdminCardsService, cardValues, stats } from './admin-cards.service.js';
import { FootyLogosService } from './footy-logos.service.js';
import { fetchFutGgCoreData } from './fut-gg-rarities.service.js';
import { searchSportsDbTeamPlayers } from './sports-db-team-players.js';
import {
  cardSlug,
  eaPosition,
  eaRatings,
  estimatedBaseOverall,
  estimatedRatings,
  initials,
  slugify,
  sportsDbPosition,
} from './squad-import.mapping.js';

type Database = typeof import('@futhub/database');
type FcClub = SquadImportClub &
  Readonly<{ leagueId: number | null; rating: number; terms: string }>;
type CardArtContext = Readonly<{
  teamLogo: Buffer | undefined;
  teamName: string;
  collectionName: string;
  primaryColor: string;
  secondaryColor: string;
}>;
type FcIndex = Readonly<{ clubs: readonly FcClub[]; leagues: readonly SquadImportLeague[] }>;
type EaPlayer = Readonly<{
  id: number;
  overallRating: number;
  firstName: string;
  lastName: string;
  commonName: string | null;
  avatarUrl: string | null;
  position: Readonly<{ shortLabel: string }>;
  alternatePositions: ReadonlyArray<Readonly<{ shortLabel: string }>> | null;
  team: Readonly<{ label: string; imageUrl?: string | null }>;
  stats: Readonly<Record<string, Readonly<{ value: number }>>>;
}>;

const eaRatingsApi = 'https://drop-api.ea.com/rating/ea-sports-fc';
const eaRatingsPage = 'https://www.ea.com/games/ea-sports-fc/ratings';
const eaPageSize = 100;
const eaMaxPages = 3;
const photoHosts = new Set(['ratings-images-prod.pulse.ea.com', 'r2.thesportsdb.com']);
const crestHost = 'drop-assets.ea.com';
const photoContentTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxPhotoBytes = 5 * 1024 * 1024;
const photoConcurrency = 6;
const clubCacheDuration = 60 * 60 * 1_000;
const clubSuggestionLimit = 12;
const defaultTeamColor = '#111111';

@Injectable()
export class SquadImportService {
  private cachedIndex: Promise<FcIndex> | null = null;
  private indexExpiresAt = 0;

  constructor(
    @Inject(AdminCardsService) private readonly cards: AdminCardsService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(FootyLogosService) private readonly footyLogos: FootyLogosService,
    @Inject(EntityEmojisService) private readonly entityEmojis: EntityEmojisService,
  ) {}

  async clubs(query: string): Promise<SquadImportClub[]> {
    const normalizedQuery = normalize(query);
    if (normalizedQuery.length < 2) return [];
    return (await this.fcIndex()).clubs
      .map((club) => ({ club, score: clubScore(club, normalizedQuery) }))
      .filter((result) => result.score >= 0)
      .sort(
        (left, right) => right.score - left.score || left.club.name.localeCompare(right.club.name),
      )
      .slice(0, clubSuggestionLimit)
      .map(({ club }) => clubReference(club));
  }

  async leagues(): Promise<SquadImportLeague[]> {
    return [...(await this.fcIndex()).leagues];
  }

  async leagueClubs(leagueId: number): Promise<SquadImportClub[]> {
    const index = await this.fcIndex();
    if (!index.leagues.some((league) => league.id === leagueId)) {
      throw new NotFoundException('Liga não encontrada na base do EA SPORTS FC.');
    }
    return index.clubs
      .filter((club) => club.leagueId === leagueId)
      .sort((left, right) => right.rating - left.rating || left.name.localeCompare(right.name))
      .map(clubReference);
  }

  async squad(query: SquadImportSquadQuery): Promise<SquadImportPreview> {
    if (query.clubId === undefined) {
      if (!query.name) throw new BadRequestException('Informe o clube ou o nome do time.');
      return this.sportsDbSquad(query.name);
    }
    const club = (await this.fcIndex()).clubs.find((candidate) => candidate.id === query.clubId);
    if (!club) throw new NotFoundException('Clube não encontrado na base do EA SPORTS FC.');
    const roster = await this.eaRoster(club.id);
    // Clubs outside EA's ratings database (e.g. Brazilian sides) come back empty.
    if (!roster.length) return this.sportsDbSquad(club.name);

    const teamName = roster[0]?.team.label || club.name;
    const crestUrl = roster[0]?.team.imageUrl ?? null;
    const players = roster.flatMap(eaPlayer);
    players.sort((left, right) => right.overall - left.overall);
    const url = new URL(eaRatingsPage);
    url.searchParams.set('team', String(club.id));
    return {
      provider: 'EA SPORTS FC',
      estimated: false,
      sourceUrl: url.toString(),
      ...(await this.teamPreview(teamName)),
      crestUrl: crestUrl && isCrestUrl(crestUrl) ? crestUrl : null,
      players,
    };
  }

  async import(input: SquadImportInput): Promise<SquadImportResult> {
    const database = await this.database();
    const [collection] = await database.db
      .select({
        slug: database.schema.collections.slug,
        name: database.schema.localizedTextTranslations.content,
        primaryColor: database.schema.collections.primaryColor,
        secondaryColor: database.schema.collections.secondaryColor,
      })
      .from(database.schema.collections)
      .leftJoin(
        database.schema.localizedTextTranslations,
        database.and(
          database.eq(
            database.schema.localizedTextTranslations.localizedTextId,
            database.schema.collections.nameTextId,
          ),
          database.eq(database.schema.localizedTextTranslations.locale, 'pt-BR'),
        ),
      )
      .where(database.eq(database.schema.collections.id, input.collectionId));
    if (!collection) throw new NotFoundException('Collection not found.');

    let team: Readonly<{ id: string; slug: string; name: string }>;
    let createdTeam = false;
    if (input.teamId) {
      const [existing] = await database.db
        .select({
          id: database.schema.teams.id,
          slug: database.schema.teams.slug,
          name: database.schema.teams.name,
        })
        .from(database.schema.teams)
        .where(database.eq(database.schema.teams.id, input.teamId));
      if (!existing) throw new NotFoundException('Team not found.');
      team = existing;
    } else {
      team = await this.cards.createTeam(input.team);
      createdTeam = true;
    }

    const taken = new Set<string>();
    const rows = input.players.map((player) => ({
      ...player,
      slug: cardSlug([player.name, team.slug, collection.slug], taken),
      collectionId: input.collectionId,
      teamId: team.id,
    }));
    const existing = await database.db
      .select({
        id: database.schema.cards.id,
        slug: database.schema.cards.slug,
        statsId: database.schema.cards.statsId,
        imageFileId: database.schema.cards.imageFileId,
      })
      .from(database.schema.cards)
      .where(
        database.inArray(
          database.schema.cards.slug,
          rows.map((row) => row.slug),
        ),
      );
    const existingBySlug = new Map(existing.map((card) => [card.slug, card]));

    // Manual card art is kept unless the admin asks to redraw it from the source photos.
    const photoRows = rows.filter(
      (row) => row.photoUrl && (input.replaceImages || !existingBySlug.get(row.slug)?.imageFileId),
    );
    const teamLogo = await this.teamLogo(team.id, input.crestUrl);
    const art: CardArtContext = {
      teamLogo,
      teamName: team.name,
      collectionName: collection.name ?? collection.slug,
      primaryColor: collection.primaryColor,
      secondaryColor: collection.secondaryColor,
    };
    const photos = new Map<string, FileDto>();
    let photoErrors = 0;
    await eachLimited(photoRows, photoConcurrency, async (row) => {
      try {
        photos.set(row.slug, await this.cardImage(row, art));
      } catch {
        photoErrors += 1;
      }
    });

    try {
      await database.db.transaction(async (tx) => {
        for (const row of rows) {
          const card = existingBySlug.get(row.slug);
          const photo = photos.get(row.slug);
          let cardId: string;
          if (card) {
            await tx
              .update(database.schema.cardStats)
              .set(stats(row))
              .where(database.eq(database.schema.cardStats.id, card.statsId));
            await tx
              .update(database.schema.cards)
              .set({
                ...cardValues(row),
                ...(photo ? { imageFileId: photo.id } : {}),
                updatedAt: new Date(),
              })
              .where(database.eq(database.schema.cards.id, card.id));
            await tx
              .delete(database.schema.cardSecondaryPositions)
              .where(database.eq(database.schema.cardSecondaryPositions.cardId, card.id));
            cardId = card.id;
          } else {
            const [statistics] = await tx
              .insert(database.schema.cardStats)
              .values(stats(row))
              .returning({ id: database.schema.cardStats.id });
            if (!statistics) throw new Error('Failed to create card statistics.');
            const [created] = await tx
              .insert(database.schema.cards)
              .values({
                ...cardValues(row),
                slug: row.slug,
                statsId: statistics.id,
                imageFileId: photo?.id ?? null,
              })
              .returning({ id: database.schema.cards.id });
            if (!created) throw new Error('Failed to create card.');
            cardId = created.id;
          }
          const secondaryPositions = (row.secondaryPositions ?? []).filter(
            (position, index, positions) =>
              position !== row.position && positions.indexOf(position) === index,
          );
          if (secondaryPositions.length) {
            await tx
              .insert(database.schema.cardSecondaryPositions)
              .values(secondaryPositions.map((position) => ({ cardId, position })));
          }
        }
      });
    } catch (error) {
      await Promise.all([...photos.values()].map((photo) => this.files.removeIfUnused(photo.id)));
      if (createdTeam) await this.cards.removeTeam(team.id).catch(() => undefined);
      throw error;
    }
    const replacedFileIds = existing.flatMap((card) =>
      card.imageFileId && photos.has(card.slug) ? [card.imageFileId] : [],
    );
    // The import is already committed; leftover art is only storage garbage.
    await Promise.all(
      replacedFileIds.map((fileId) => this.files.removeIfUnused(fileId).catch(() => undefined)),
    );

    return {
      teamId: team.id,
      createCount: rows.length - existing.length,
      updateCount: existing.length,
      photoCount: photos.size,
      photoErrors,
    };
  }

  // Teams without a badge get the EA crest, so every imported card shows its club.
  private async teamLogo(
    teamId: string,
    crestUrl: string | null | undefined,
  ): Promise<Buffer | undefined> {
    const database = await this.database();
    const [team] = await database.db
      .select({ logoFileId: database.schema.teams.logoFileId })
      .from(database.schema.teams)
      .where(database.eq(database.schema.teams.id, teamId));
    let logoFileId = team?.logoFileId ?? null;
    try {
      if (!logoFileId && crestUrl) {
        const crest = await this.files.importImage(crestUrl, 'image/png');
        await database.db
          .update(database.schema.teams)
          .set({ logoFileId: crest.id, updatedAt: new Date() })
          .where(database.eq(database.schema.teams.id, teamId));
        logoFileId = crest.id;
        await this.entityEmojis.sync('team', teamId);
      }
      return logoFileId ? await this.files.read(logoFileId) : undefined;
    } catch {
      // The badge only decorates the card art; the squad still imports without it.
      return undefined;
    }
  }

  private async sportsDbSquad(name: string): Promise<SquadImportPreview> {
    const result = await searchSportsDbTeamPlayers(name);
    if (!result.team) throw new NotFoundException('Time não encontrado no TheSportsDB.');
    const players = result.players.map((player): SquadImportPreviewPlayer => {
      const position = sportsDbPosition(player.position);
      return {
        sourceId: player.id,
        name: player.name.slice(0, 100),
        position,
        secondaryPositions: [],
        ...estimatedRatings(position, estimatedBaseOverall),
        photoUrl: player.cutoutUrl && isPhotoUrl(player.cutoutUrl) ? player.cutoutUrl : null,
      };
    });
    return {
      provider: 'TheSportsDB',
      estimated: true,
      sourceUrl: result.team.sourceUrl,
      ...(await this.teamPreview(result.team.name)),
      crestUrl: null,
      players,
    };
  }

  private async teamPreview(
    name: string,
  ): Promise<Pick<SquadImportPreview, 'team' | 'existingTeam'>> {
    const teamName = name.trim().slice(0, 100);
    const identity = await this.teamIdentity(teamName);
    const team = {
      name: teamName,
      slug: slugify(teamName).slice(0, 100).replace(/-+$/, '') || 'time',
      emoji: identity?.symbol ?? initials(teamName),
      color: identity?.colors[0] ?? defaultTeamColor,
      colors: identity?.colors.length ? identity.colors.slice(0, 8) : [defaultTeamColor],
      imageUrl: identity?.imageUrl ?? null,
    } satisfies TeamInput;
    return { team, existingTeam: await this.existingTeam(team) };
  }

  private async teamIdentity(name: string) {
    try {
      const normalizedName = normalize(name);
      const [best] = await this.footyLogos.search(name);
      if (!best) return null;
      const candidate = normalize(best.name.replace(/\([^)]*\)/g, ''));
      if (!candidate.startsWith(normalizedName) && !normalizedName.startsWith(candidate)) {
        return null;
      }
      const details = await this.footyLogos.details(best.slug);
      return {
        symbol: details.symbol,
        colors: details.colors.filter((color) => /^#[0-9A-F]{6}$/i.test(color)),
        imageUrl: details.imageUrl,
      };
    } catch {
      // FootyLogos only enriches the preview; the admin can still pick a badge later.
      return null;
    }
  }

  private async existingTeam(team: TeamInput): Promise<CardReference | null> {
    const database = await this.database();
    const [existing] = await database.db
      .select({
        id: database.schema.teams.id,
        name: database.schema.teams.name,
        slug: database.schema.teams.slug,
        emoji: database.schema.teams.emoji,
        logoFileId: database.schema.teams.logoFileId,
      })
      .from(database.schema.teams)
      .where(
        database.sql<boolean>`(${database.schema.teams.slug} = ${team.slug} OR lower(${database.schema.teams.name}) = lower(${team.name}))`,
      )
      .limit(1);
    if (!existing) return null;
    const { logoFileId, ...reference } = existing;
    const urls = await this.files.urls(logoFileId ? [logoFileId] : []);
    return { ...reference, imageUrl: logoFileId ? (urls.get(logoFileId) ?? null) : null };
  }

  private async eaRoster(teamId: number): Promise<EaPlayer[]> {
    const players: EaPlayer[] = [];
    try {
      for (let page = 0; page < eaMaxPages; page += 1) {
        const url = new URL(eaRatingsApi);
        url.searchParams.set('locale', 'en');
        url.searchParams.set('limit', String(eaPageSize));
        url.searchParams.set('offset', String(page * eaPageSize));
        url.searchParams.set('team', String(teamId));
        const response = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`EA ratings returned ${response.status}.`);
        const source: unknown = await response.json();
        if (
          typeof source !== 'object' ||
          source === null ||
          !('items' in source) ||
          !Array.isArray(source.items)
        ) {
          throw new Error('EA ratings returned an invalid response.');
        }
        players.push(...source.items.filter(isEaPlayer));
        const total =
          'totalItems' in source && typeof source.totalItems === 'number' ? source.totalItems : 0;
        if (source.items.length < eaPageSize || players.length >= total) break;
      }
    } catch {
      throw new BadGatewayException('EA SPORTS FC ratings are unavailable.');
    }
    return players;
  }

  private fcIndex(): Promise<FcIndex> {
    if (!this.cachedIndex || Date.now() >= this.indexExpiresAt) {
      this.cachedIndex = this.loadIndex().then(
        (index) => {
          this.indexExpiresAt = Date.now() + clubCacheDuration;
          return index;
        },
        (error: unknown) => {
          this.cachedIndex = null;
          throw error;
        },
      );
    }
    return this.cachedIndex;
  }

  private async loadIndex(): Promise<FcIndex> {
    const data = await fetchFutGgCoreData();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('clubs' in data) ||
      !Array.isArray(data.clubs) ||
      !('leagues' in data) ||
      !Array.isArray(data.leagues)
    ) {
      throw new BadGatewayException('FUT.GG returned invalid club data.');
    }
    const leagues = new Map<number, Omit<SquadImportLeague, 'clubCount'>>();
    for (const league of data.leagues) {
      if (
        typeof league === 'object' &&
        league !== null &&
        'eaId' in league &&
        'name' in league &&
        typeof league.eaId === 'number' &&
        typeof league.name === 'string'
      ) {
        const imageUrl =
          'imageUrl' in league && typeof league.imageUrl === 'string' ? league.imageUrl : '';
        leagues.set(league.eaId, { id: league.eaId, name: league.name, imageUrl });
      }
    }
    const clubs = data.clubs.flatMap((club: unknown): FcClub[] => {
      if (
        typeof club !== 'object' ||
        club === null ||
        !('eaId' in club) ||
        !('name' in club) ||
        !('imageUrl' in club) ||
        typeof club.eaId !== 'number' ||
        typeof club.name !== 'string' ||
        typeof club.imageUrl !== 'string' ||
        ('isIconClub' in club && club.isIconClub === true)
      ) {
        return [];
      }
      const leagueId =
        'leagueEaId' in club && typeof club.leagueEaId === 'number' ? club.leagueEaId : null;
      const league = (leagueId === null ? undefined : leagues.get(leagueId))?.name ?? '';
      return [
        {
          id: club.eaId,
          name: club.name,
          league,
          imageUrl: club.imageUrl,
          leagueId,
          rating:
            'overallRating' in club && typeof club.overallRating === 'number'
              ? club.overallRating
              : 0,
          terms: normalize(`${club.name} ${league}`),
        },
      ];
    });
    const clubCounts = new Map<number, number>();
    for (const club of clubs) {
      if (club.leagueId !== null) {
        clubCounts.set(club.leagueId, (clubCounts.get(club.leagueId) ?? 0) + 1);
      }
    }
    // FUT.GG already lists leagues by relevance; leagues without playable clubs are dropped.
    return {
      clubs,
      leagues: [...leagues.values()].flatMap((league) => {
        const clubCount = clubCounts.get(league.id) ?? 0;
        return clubCount ? [{ ...league, clubCount }] : [];
      }),
    };
  }

  // Card files hold the finished card art, so the source portrait is drawn inside the frame.
  private async cardImage(player: SquadImportPlayer, art: CardArtContext): Promise<FileDto> {
    const playerImage = await this.sourcePhoto(player.photoUrl ?? '');
    const buffer = await renderTeamCardImage({
      ...art,
      name: player.name,
      overall: player.overall,
      position: player.position,
      stats: {
        pace: player.pace,
        finishing: player.finishing,
        passing: player.passing,
        dribbling: player.dribbling,
        marking: player.marking,
        control: player.control,
      },
      playerImage,
    });
    return this.files.generated(imageFile(buffer, 'image/png'));
  }

  private async sourcePhoto(sourceUrl: string): Promise<Buffer> {
    if (!isPhotoUrl(sourceUrl)) throw new BadRequestException('Photo host is not allowed.');
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Photo source returned ${response.status}.`);
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!photoContentTypes.has(contentType)) throw new Error('Photo source is not an image.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxPhotoBytes) throw new Error('Photo source is too large.');
    return buffer;
  }

  private async database(): Promise<Database> {
    return import('@futhub/database');
  }
}

function clubReference({ id, name, league, imageUrl }: FcClub): SquadImportClub {
  return { id, name, league, imageUrl };
}

function eaPlayer(player: EaPlayer): SquadImportPreviewPlayer[] {
  const position = eaPosition(player.position.shortLabel);
  if (!position) return [];
  const secondaryPositions = (player.alternatePositions ?? []).flatMap((alternate) => {
    const mapped = eaPosition(alternate.shortLabel);
    return mapped && mapped !== position ? [mapped] : [];
  });
  const name = (player.commonName?.trim() || `${player.firstName} ${player.lastName}`.trim()).slice(
    0,
    100,
  );
  return [
    {
      sourceId: String(player.id),
      name,
      position,
      secondaryPositions: [...new Set(secondaryPositions)],
      ...eaRatings(position, player.overallRating, (stat) => player.stats[stat]?.value ?? 0),
      photoUrl: player.avatarUrl && isPhotoUrl(player.avatarUrl) ? player.avatarUrl : null,
    },
  ];
}

function isEaPlayer(value: unknown): value is EaPlayer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'overallRating' in value &&
    'firstName' in value &&
    'lastName' in value &&
    'position' in value &&
    'team' in value &&
    'stats' in value &&
    typeof value.id === 'number' &&
    typeof value.overallRating === 'number' &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string' &&
    typeof value.position === 'object' &&
    value.position !== null &&
    'shortLabel' in value.position &&
    typeof value.position.shortLabel === 'string' &&
    typeof value.team === 'object' &&
    value.team !== null &&
    'label' in value.team &&
    typeof value.team.label === 'string' &&
    typeof value.stats === 'object' &&
    value.stats !== null
  );
}

function isCrestUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === crestHost;
  } catch {
    return false;
  }
}

function isPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && photoHosts.has(url.hostname);
  } catch {
    return false;
  }
}

function clubScore(club: FcClub, query: string): number {
  const name = normalize(club.name);
  if (name === query) return 1_000;
  if (name.startsWith(query)) return 700;
  if (name.includes(query)) return 400;
  return club.terms.includes(query) ? 100 : -1;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

async function eachLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next];
        next += 1;
        if (item !== undefined) await task(item);
      }
    }),
  );
}
