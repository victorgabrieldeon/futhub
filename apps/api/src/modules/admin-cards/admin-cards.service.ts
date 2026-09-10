import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';

import type {
  AdminCard,
  AdminCollection,
  AdminTeam,
  CardCatalog,
  CardInput,
  CardListQuery,
  CardPage,
  CardPosition,
  CardReference,
  CardUpdate,
  CollectionInput,
  CollectionListQuery,
  CollectionPage,
  ImportError,
  ImportPreview,
  TeamInput,
  TeamPage,
  TeamListQuery,
} from './admin-cards.dto.js';
import { CardImageStorage, type ImageFile } from './card-image-storage.service.js';
import { FootyLogosService } from './footy-logos.service.js';
import { FutGgRaritiesService } from './fut-gg-rarities.service.js';
import { PlayerPhotosService } from './player-photos.service.js';

type Database = typeof import('@futhub/database');
type CatalogMaps = CardCatalog & {
  collectionNames: Map<string, string[]>;
  teamNames: Map<string, string[]>;
};
type ImportRow = CardInput;

const positions: Record<CardPosition, true> = {
  GOL: true,
  LD: true,
  LE: true,
  ZAG: true,
  VOL: true,
  MA: true,
  MC: true,
  PD: true,
  PE: true,
  CA: true,
};
const positionValues = Object.keys(positions) as CardPosition[];
const importColumns = [
  { key: 'slug', label: 'Código único' },
  { key: 'name', label: 'Nome do jogador' },
  { key: 'collection', label: 'Coleção' },
  { key: 'team', label: 'Time' },
  { key: 'position', label: 'Posição principal' },
  { key: 'secondaryPositions', label: 'Posições secundárias' },
  { key: 'contractsBlocked', label: 'Bloquear contratos?' },
  { key: 'defense', label: 'Defesa' },
  { key: 'attack', label: 'Ataque' },
  { key: 'creation', label: 'Criação' },
  { key: 'overall', label: 'Overall' },
  { key: 'passing', label: 'Passe' },
  { key: 'control', label: 'Controle' },
  { key: 'marking', label: 'Marcação' },
  { key: 'pace', label: 'Ritmo' },
  { key: 'dribbling', label: 'Drible' },
  { key: 'finishing', label: 'Finalização' },
] as const;
type ImportColumn = (typeof importColumns)[number]['key'];

const headers = importColumns.map(({ key }) => key) as ImportColumn[];
const headerKeysByLabel = Object.fromEntries(
  importColumns.map(({ key, label }) => [label, key]),
) as Record<string, ImportColumn>;
const headerLabelsByKey = Object.fromEntries(
  importColumns.map(({ key, label }) => [key, label]),
) as Record<ImportColumn, string>;
const templateRows = 250;

@Injectable()
export class AdminCardsService {
  constructor(
    @Inject(CardImageStorage) private readonly images: CardImageStorage,
    @Inject(FootyLogosService) private readonly footyLogos: FootyLogosService,
    @Inject(FutGgRaritiesService) private readonly futGgRarities: FutGgRaritiesService,
    @Inject(PlayerPhotosService) private readonly playerPhotos: PlayerPhotosService,
  ) {}
  async catalog(): Promise<CardCatalog> {
    const catalog = await this.loadCatalog();
    return {
      collections: catalog.collections,
      teams: catalog.teams,
    };
  }

  teamLogoSuggestions(query: string) {
    return this.footyLogos.search(query);
  }

  teamLogoDetails(slug: string) {
    return this.footyLogos.details(slug);
  }

  teamLogo(slug: string) {
    return this.footyLogos.image(slug);
  }
  collectionArtworkSuggestions(query: string) {
    return this.futGgRarities.search(query);
  }

  playerPhotoSuggestions(query: string) {
    return this.playerPhotos.search(query);
  }

  playerPhoto(kindOrFilename: string, filename?: string) {
    const kind = filename ? kindOrFilename : 'cutout';
    return this.playerPhotos.image(kind, filename ?? kindOrFilename);
  }

  async collections(query: CollectionListQuery): Promise<CollectionPage> {
    const database = await this.database();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.query?.trim();
    const pattern = search ? `%${search}%` : '';
    const filter = database.and(
      search
        ? database.sql<boolean>`(${database.schema.localizedTextTranslations.content} ILIKE ${pattern} OR ${database.schema.collections.slug} ILIKE ${pattern})`
        : undefined,
      query.contractsBlocked === undefined
        ? undefined
        : database.eq(database.schema.collections.contractsBlocked, query.contractsBlocked),
    );
    const joinTranslation = database.and(
      database.eq(
        database.schema.localizedTextTranslations.localizedTextId,
        database.schema.collections.nameTextId,
      ),
      database.eq(database.schema.localizedTextTranslations.locale, 'pt-BR'),
    );
    const [items, count] = await Promise.all([
      database.db
        .select({
          id: database.schema.collections.id,
          slug: database.schema.collections.slug,
          name: database.schema.localizedTextTranslations.content,
          emoji: database.schema.collections.emoji,
          primaryColor: database.schema.collections.primaryColor,
          secondaryColor: database.schema.collections.secondaryColor,
          imageUrl: database.schema.collections.imageUrl,
          overlayUrl: database.schema.collections.overlayUrl,
          bannerUrl: database.schema.collections.bannerUrl,
          contractsBlocked: database.schema.collections.contractsBlocked,
        })
        .from(database.schema.collections)
        .innerJoin(database.schema.localizedTextTranslations, joinTranslation)
        .where(filter)
        .orderBy(database.desc(database.schema.collections.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      database.db
        .select({ count: database.sql<number>`count(*)::int` })
        .from(database.schema.collections)
        .innerJoin(database.schema.localizedTextTranslations, joinTranslation)
        .where(filter),
    ]);
    return { items, total: count[0]?.count ?? 0, page, pageSize };
  }

  async createCollection(input: CollectionInput): Promise<AdminCollection> {
    const database = await this.database();
    return database.db.transaction(async (tx) => {
      const [text] = await tx
        .insert(database.schema.localizedTexts)
        .values({})
        .returning({ id: database.schema.localizedTexts.id });
      if (!text) throw new Error('Failed to create collection name.');
      await tx.insert(database.schema.localizedTextTranslations).values({
        localizedTextId: text.id,
        locale: 'pt-BR',
        content: input.name,
      });
      const [collection] = await tx
        .insert(database.schema.collections)
        .values({
          slug: input.slug,
          nameTextId: text.id,
          emoji: input.emoji,
          primaryColor: input.primaryColor,
          secondaryColor: input.secondaryColor,
          imageUrl: input.imageUrl ?? null,
          overlayUrl: input.overlayUrl ?? null,
          bannerUrl: input.bannerUrl ?? null,
          contractsBlocked: input.contractsBlocked ?? false,
        })
        .returning({ id: database.schema.collections.id });
      if (!collection) throw new Error('Failed to create collection.');
      return {
        id: collection.id,
        ...input,
        imageUrl: input.imageUrl ?? null,
        overlayUrl: input.overlayUrl ?? null,
        bannerUrl: input.bannerUrl ?? null,
        contractsBlocked: input.contractsBlocked ?? false,
      };
    });
  }

  async updateCollection(collectionId: string, input: CollectionInput): Promise<AdminCollection> {
    const database = await this.database();
    const [collection] = await database.db
      .select({ nameTextId: database.schema.collections.nameTextId })
      .from(database.schema.collections)
      .where(database.eq(database.schema.collections.id, collectionId));
    if (!collection) throw new NotFoundException('Collection not found.');
    await database.db.transaction(async (tx) => {
      await tx
        .update(database.schema.localizedTextTranslations)
        .set({ content: input.name, updatedAt: new Date() })
        .where(
          database.and(
            database.eq(
              database.schema.localizedTextTranslations.localizedTextId,
              collection.nameTextId,
            ),
            database.eq(database.schema.localizedTextTranslations.locale, 'pt-BR'),
          ),
        );
      await tx
        .update(database.schema.collections)
        .set({
          slug: input.slug,
          emoji: input.emoji,
          primaryColor: input.primaryColor,
          secondaryColor: input.secondaryColor,
          imageUrl: input.imageUrl ?? null,
          overlayUrl: input.overlayUrl ?? null,
          bannerUrl: input.bannerUrl ?? null,
          contractsBlocked: input.contractsBlocked ?? false,
          updatedAt: new Date(),
        })
        .where(database.eq(database.schema.collections.id, collectionId));
    });
    return this.collection(collectionId);
  }

  async removeCollection(collectionId: string): Promise<void> {
    const database = await this.database();
    const [collection] = await database.db
      .select({ nameTextId: database.schema.collections.nameTextId })
      .from(database.schema.collections)
      .where(database.eq(database.schema.collections.id, collectionId));
    if (!collection) throw new NotFoundException('Collection not found.');
    try {
      await database.db.transaction(async (tx) => {
        await tx
          .delete(database.schema.collections)
          .where(database.eq(database.schema.collections.id, collectionId));
        await tx
          .delete(database.schema.localizedTexts)
          .where(database.eq(database.schema.localizedTexts.id, collection.nameTextId));
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new ConflictException('Collection is in use.');
      throw error;
    }
  }

  async teams(query: TeamListQuery): Promise<TeamPage> {
    const database = await this.database();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.query?.trim();
    const pattern = search ? `%${search}%` : '';
    const filter = database.and(
      search
        ? database.sql<boolean>`(${database.schema.teams.name} ILIKE ${pattern} OR ${database.schema.teams.slug} ILIKE ${pattern})`
        : undefined,
      query.image === 'custom'
        ? database.sql<boolean>`${database.schema.teams.imageUrl} IS NOT NULL`
        : query.image === 'default'
          ? database.sql<boolean>`${database.schema.teams.imageUrl} IS NULL`
          : undefined,
    );
    const [items, count] = await Promise.all([
      database.db
        .select({
          id: database.schema.teams.id,
          slug: database.schema.teams.slug,
          name: database.schema.teams.name,
          emoji: database.schema.teams.emoji,
          color: database.schema.teams.color,
          colors: database.schema.teams.colors,
          imageUrl: database.schema.teams.imageUrl,
        })
        .from(database.schema.teams)
        .where(filter)
        .orderBy(database.desc(database.schema.teams.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      database.db
        .select({ count: database.sql<number>`count(*)::int` })
        .from(database.schema.teams)
        .where(filter),
    ]);
    return { items, total: count[0]?.count ?? 0, page, pageSize };
  }

  async createTeam(input: TeamInput): Promise<AdminTeam> {
    assertSvgTeamLogo(input.imageUrl);
    const database = await this.database();
    try {
      const [team] = await database.db
        .insert(database.schema.teams)
        .values({
          ...input,
          colors: input.colors ?? [input.color],
          imageUrl: input.imageUrl ?? null,
        })
        .returning({
          id: database.schema.teams.id,
          slug: database.schema.teams.slug,
          name: database.schema.teams.name,
          emoji: database.schema.teams.emoji,
          color: database.schema.teams.color,
          colors: database.schema.teams.colors,
          imageUrl: database.schema.teams.imageUrl,
        });
      if (!team) throw new Error('Failed to create team.');
      return team;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('Team name or slug already exists.');
      throw error;
    }
  }

  async updateTeam(teamId: string, input: TeamInput): Promise<AdminTeam> {
    assertSvgTeamLogo(input.imageUrl);
    const database = await this.database();
    try {
      const [team] = await database.db
        .update(database.schema.teams)
        .set({
          ...input,
          colors: input.colors ?? [input.color],
          imageUrl: input.imageUrl ?? null,
          updatedAt: new Date(),
        })
        .where(database.eq(database.schema.teams.id, teamId))
        .returning({
          id: database.schema.teams.id,
          slug: database.schema.teams.slug,
          name: database.schema.teams.name,
          emoji: database.schema.teams.emoji,
          color: database.schema.teams.color,
          colors: database.schema.teams.colors,
          imageUrl: database.schema.teams.imageUrl,
        });
      if (!team) throw new NotFoundException('Team not found.');
      return team;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('Team name or slug already exists.');
      throw error;
    }
  }

  async removeTeam(teamId: string): Promise<void> {
    const database = await this.database();
    try {
      const [team] = await database.db
        .delete(database.schema.teams)
        .where(database.eq(database.schema.teams.id, teamId))
        .returning({ id: database.schema.teams.id });
      if (!team) throw new NotFoundException('Team not found.');
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new ConflictException('Team is in use.');
      throw error;
    }
  }

  async template(): Promise<Buffer> {
    const catalog = await this.catalog();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FutHub';

    const cards = workbook.addWorksheet('Cards');
    cards.addRow(importColumns.map(({ label }) => label));
    cards.getRow(1).font = { bold: true };
    cards.views = [{ state: 'frozen', ySplit: 1 }];
    for (const [index, column] of importColumns.entries()) {
      cards.getColumn(index + 1).width = Math.max(16, column.label.length + 4);
    }

    const references = workbook.addWorksheet('Referências');
    references.addRow(['Coleções disponíveis', 'Times disponíveis']);
    const referenceRows = Math.max(catalog.collections.length, catalog.teams.length);
    for (let index = 0; index < referenceRows; index++) {
      references.addRow([catalog.collections[index]?.name ?? '', catalog.teams[index]?.name ?? '']);
    }
    references.getRow(1).font = { bold: true };
    references.getColumn(1).width = 42;
    references.getColumn(2).width = 42;

    const options = workbook.addWorksheet('Opções');
    options.addRow(['Posições disponíveis', 'Bloquear contratos?']);
    for (const [index, position] of positionValues.entries()) {
      options.addRow([position, index === 0 ? 'Não' : index === 1 ? 'Sim' : '']);
    }
    options.getRow(1).font = { bold: true };
    options.state = 'hidden';

    const positionColumn = headers.indexOf('position') + 1;
    const contractsColumn = headers.indexOf('contractsBlocked') + 1;
    const collectionColumn = headers.indexOf('collection') + 1;
    const teamColumn = headers.indexOf('team') + 1;
    const positionFormula = "'Opções'!$A$2:$A$11";
    const contractsFormula = "'Opções'!$B$2:$B$3";
    const collectionFormula = catalog.collections.length
      ? `'Referências'!$A$2:$A$${catalog.collections.length + 1}`
      : null;
    const teamFormula = catalog.teams.length
      ? `'Referências'!$B$2:$B$${catalog.teams.length + 1}`
      : null;

    for (let row = 2; row <= templateRows + 1; row++) {
      cards.getCell(row, contractsColumn).value = 'Não';
      cards.getCell(row, positionColumn).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [positionFormula],
        showErrorMessage: true,
        errorTitle: 'Posição inválida',
        error: 'Escolha uma posição da lista.',
      };
      cards.getCell(row, contractsColumn).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [contractsFormula],
        showErrorMessage: true,
        errorTitle: 'Valor inválido',
        error: 'Escolha Sim ou Não.',
      };
      if (collectionFormula) {
        cards.getCell(row, collectionColumn).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [collectionFormula],
          showErrorMessage: true,
          errorTitle: 'Coleção inválida',
          error: 'Escolha uma coleção da lista.',
        };
      }
      if (teamFormula) {
        cards.getCell(row, teamColumn).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [teamFormula],
          showErrorMessage: true,
          errorTitle: 'Time inválido',
          error: 'Escolha um time da lista.',
        };
      }
    }

    const instructions = workbook.addWorksheet('Instruções');
    instructions.addRows([
      ['Campo', 'Como preencher'],
      [
        'Código único',
        'Letras minúsculas, números e hífens. Reenvio com mesmo código atualiza o card.',
      ],
      [
        'Coleção e Time',
        'Escolha um nome nas listas da planilha. Crie as referências antes de importar.',
      ],
      ['Posição principal', 'Escolha uma posição na lista.'],
      [
        'Posições secundárias',
        'Opcional. Separe posições válidas por ponto e vírgula. Exemplo: MC;MA.',
      ],
      ['Bloquear contratos?', 'O modelo começa com Não. Escolha Sim apenas quando necessário.'],
      ['Atributos', 'Use números inteiros positivos. Overall deve ficar entre 60 e 100.'],
    ]);
    instructions.getRow(1).font = { bold: true };
    instructions.getColumn(1).width = 28;
    instructions.getColumn(2).width = 92;
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(buffer: Buffer): Promise<ImportPreview> {
    const parsed = await this.parseWorkbook(buffer);
    if (parsed.errors.length)
      return { valid: false, createCount: 0, updateCount: 0, errors: parsed.errors };
    const database = await this.database();
    const slugs = parsed.rows.map((row) => row.slug);
    const existing = slugs.length
      ? await database.db
          .select({ slug: database.schema.cards.slug })
          .from(database.schema.cards)
          .where(database.inArray(database.schema.cards.slug, slugs))
      : [];
    return {
      valid: true,
      createCount: parsed.rows.length - existing.length,
      updateCount: existing.length,
      errors: [],
    };
  }

  async import(buffer: Buffer): Promise<ImportPreview> {
    const parsed = await this.parseWorkbook(buffer);
    if (parsed.errors.length) throw new BadRequestException({ errors: parsed.errors });
    const database = await this.database();
    const slugs = parsed.rows.map((row) => row.slug);
    const existing = slugs.length
      ? await database.db
          .select({
            id: database.schema.cards.id,
            slug: database.schema.cards.slug,
            statsId: database.schema.cards.statsId,
          })
          .from(database.schema.cards)
          .where(database.inArray(database.schema.cards.slug, slugs))
      : [];
    const existingBySlug = new Map(existing.map((card) => [card.slug, card]));
    await database.db.transaction(async (tx) => {
      for (const row of parsed.rows) {
        const card = existingBySlug.get(row.slug);
        if (card) {
          await tx
            .update(database.schema.cardStats)
            .set(stats(row))
            .where(database.eq(database.schema.cardStats.id, card.statsId));
          await tx
            .update(database.schema.cards)
            .set(cardValues(row))
            .where(database.eq(database.schema.cards.id, card.id));
          await tx
            .delete(database.schema.cardSecondaryPositions)
            .where(database.eq(database.schema.cardSecondaryPositions.cardId, card.id));
          if (row.secondaryPositions?.length) {
            await tx
              .insert(database.schema.cardSecondaryPositions)
              .values(row.secondaryPositions.map((position) => ({ cardId: card.id, position })));
          }
          continue;
        }
        const [statistics] = await tx
          .insert(database.schema.cardStats)
          .values(stats(row))
          .returning({ id: database.schema.cardStats.id });
        if (!statistics) throw new Error('Failed to create card statistics.');
        const [created] = await tx
          .insert(database.schema.cards)
          .values({ ...cardValues(row), slug: row.slug, statsId: statistics.id })
          .returning({ id: database.schema.cards.id });
        if (!created) throw new Error('Failed to create card.');
        if (row.secondaryPositions?.length) {
          await tx
            .insert(database.schema.cardSecondaryPositions)
            .values(row.secondaryPositions.map((position) => ({ cardId: created.id, position })));
        }
      }
    });
    return {
      valid: true,
      createCount: parsed.rows.length - existing.length,
      updateCount: existing.length,
      errors: [],
    };
  }

  async list(query: CardListQuery): Promise<CardPage> {
    const database = await this.database();
    const [catalog, cards] = await Promise.all([
      this.loadCatalog(),
      database.db.select().from(database.schema.cards),
    ]);
    const [positionsByCard, statisticsById] = await Promise.all([
      this.positionsByCard(cards.map((card) => card.id)),
      this.statisticsById(cards.map((card) => card.statsId)),
    ]);
    const text = normalize(query.query ?? '');
    const filtered = cards.filter((card) => {
      const collection =
        catalog.collections.find((entry) => entry.id === card.collectionId)?.name ?? '';
      const team = catalog.teams.find((entry) => entry.id === card.teamId)?.name ?? '';
      return (
        (!text ||
          [card.name, card.slug, collection, team].some((value) =>
            normalize(value).includes(text),
          )) &&
        (!query.collectionId || card.collectionId === query.collectionId) &&
        (!query.teamId || card.teamId === query.teamId) &&
        (!query.position || card.position === query.position) &&
        (query.contractsBlocked === undefined ||
          card.contractsBlocked === query.contractsBlocked) &&
        (!query.image || (query.image === 'custom' ? Boolean(card.imageUrl) : !card.imageUrl))
      );
    });
    filtered.sort((left, right) => {
      if (query.sort === 'overall')
        return right.overall - left.overall || left.name.localeCompare(right.name);
      if (query.sort === 'name') return left.name.localeCompare(right.name);
      return right.createdAt.getTime() - left.createdAt.getTime();
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);
    const defaultImageUrl = items.some((card) => !card.imageUrl)
      ? await this.images.defaultImageUrl()
      : '';
    return {
      items: items.map((card) =>
        this.toCard(card, catalog, positionsByCard, statisticsById, defaultImageUrl),
      ),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async get(cardId: string): Promise<AdminCard> {
    const [card, catalog] = await Promise.all([this.cardById(cardId), this.loadCatalog()]);
    const [positionsByCard, statisticsById] = await Promise.all([
      this.positionsByCard([card.id]),
      this.statisticsById([card.statsId]),
    ]);
    const defaultImageUrl = card.imageUrl ? '' : await this.images.defaultImageUrl();
    return this.toCard(card, catalog, positionsByCard, statisticsById, defaultImageUrl);
  }

  async create(input: CardInput): Promise<AdminCard> {
    const database = await this.database();
    const [statistics] = await database.db
      .insert(database.schema.cardStats)
      .values(stats(input))
      .returning({ id: database.schema.cardStats.id });
    if (!statistics) throw new Error('Failed to create card statistics.');
    try {
      const [card] = await database.db
        .insert(database.schema.cards)
        .values({ ...cardValues(input), slug: input.slug, statsId: statistics.id })
        .returning({ id: database.schema.cards.id });
      if (!card) throw new Error('Failed to create card.');
      if (input.secondaryPositions?.length) {
        await database.db
          .insert(database.schema.cardSecondaryPositions)
          .values(input.secondaryPositions.map((position) => ({ cardId: card.id, position })));
      }
      return this.get(card.id);
    } catch (error) {
      await database.db
        .delete(database.schema.cardStats)
        .where(database.eq(database.schema.cardStats.id, statistics.id));
      if (isUniqueViolation(error)) throw new ConflictException('Slug already exists.');
      throw error;
    }
  }

  async update(cardId: string, input: CardUpdate): Promise<AdminCard> {
    const database = await this.database();
    const card = await this.cardById(cardId);
    await database.db.transaction(async (tx) => {
      await tx
        .update(database.schema.cardStats)
        .set(stats(input))
        .where(database.eq(database.schema.cardStats.id, card.statsId));
      await tx
        .update(database.schema.cards)
        .set(cardValues(input))
        .where(database.eq(database.schema.cards.id, cardId));
      await tx
        .delete(database.schema.cardSecondaryPositions)
        .where(database.eq(database.schema.cardSecondaryPositions.cardId, cardId));
      if (input.secondaryPositions?.length) {
        await tx
          .insert(database.schema.cardSecondaryPositions)
          .values(input.secondaryPositions.map((position) => ({ cardId, position })));
      }
    });
    return this.get(cardId);
  }

  async uploadImage(cardId: string, image: ImageFile): Promise<AdminCard> {
    const database = await this.database();
    const card = await this.cardById(cardId);
    const url = await this.images.upload(cardId, image);
    await database.db
      .update(database.schema.cards)
      .set({ imageUrl: url })
      .where(database.eq(database.schema.cards.id, card.id));
    if (card.imageUrl && card.imageUrl !== url) await this.images.remove(card.imageUrl);
    return this.get(cardId);
  }

  async removeImage(cardId: string): Promise<AdminCard> {
    const database = await this.database();
    const card = await this.cardById(cardId);
    await database.db
      .update(database.schema.cards)
      .set({ imageUrl: null })
      .where(database.eq(database.schema.cards.id, card.id));
    await this.images.remove(card.imageUrl);
    return this.get(cardId);
  }

  async remove(cardId: string): Promise<void> {
    const database = await this.database();
    const card = await this.cardById(cardId);
    const [usage] = await database.db
      .select({ count: database.sql<number>`count(*)::int` })
      .from(database.schema.userCards)
      .where(database.eq(database.schema.userCards.cardId, cardId));
    if (usage?.count) throw new ConflictException('Card belongs to one or more players.');
    await database.db.transaction(async (tx) => {
      await tx
        .delete(database.schema.cardSecondaryPositions)
        .where(database.eq(database.schema.cardSecondaryPositions.cardId, cardId));
      await tx.delete(database.schema.cards).where(database.eq(database.schema.cards.id, cardId));
      await tx
        .delete(database.schema.cardStats)
        .where(database.eq(database.schema.cardStats.id, card.statsId));
    });
    await this.images.remove(card.imageUrl);
  }

  private async parseWorkbook(
    buffer: Buffer,
  ): Promise<{ rows: ImportRow[]; errors: ImportError[] }> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException('Arquivo .xlsx inválido.');
    }
    const sheet = workbook.getWorksheet('Cards');
    if (!sheet) throw new BadRequestException('A aba "Cards" é obrigatória.');
    const indexes = new Map<ImportColumn, number>();
    for (let column = 1; column <= sheet.getRow(1).cellCount; column++) {
      const key = headerKeysByLabel[sheet.getRow(1).getCell(column).text.trim()];
      if (key) indexes.set(key, column);
    }
    const missing = importColumns.filter(({ key }) => !indexes.has(key));
    if (missing.length) {
      throw new BadRequestException(
        `Colunas obrigatórias ausentes: ${missing.map(({ label }) => label).join(', ')}.`,
      );
    }
    const catalog = await this.loadCatalog();
    const rows: ImportRow[] = [];
    const errors: ImportError[] = [];
    const slugs = new Set<string>();
    for (let number = 2; number <= sheet.rowCount; number++) {
      const row = sheet.getRow(number);
      const values = Object.fromEntries(
        headers.map((header) => [header, row.getCell(indexes.get(header) as number).text.trim()]),
      );
      if (
        headers.filter((header) => header !== 'contractsBlocked').every((header) => !values[header])
      )
        continue;
      const input = this.readImportRow(number, values, catalog, errors);
      if (!input) continue;
      if (slugs.has(input.slug)) {
        errors.push({
          row: number,
          field: 'slug',
          message: 'Código único duplicado na planilha.',
        });
      }
      slugs.add(input.slug);
      rows.push(input);
    }
    if (!rows.length && !errors.length) {
      errors.push({
        row: 1,
        field: 'Cards',
        message: 'A planilha não possui jogadores preenchidos.',
      });
    }
    return {
      rows,
      errors: errors.map((error) => ({
        ...error,
        field: headerLabelsByKey[error.field as ImportColumn] ?? error.field,
      })),
    };
  }

  private readImportRow(
    row: number,
    values: Record<string, string>,
    catalog: CatalogMaps,
    errors: ImportError[],
  ): ImportRow | null {
    const getReference = (
      field: string,
      names: Map<string, string[]>,
      optional = false,
    ): string | null => {
      const value = values[field] ?? '';
      if (!value && optional) return null;
      const matches = names.get(normalize(value)) ?? [];
      if (matches.length !== 1) {
        errors.push({
          row,
          field,
          message: matches.length ? 'A referência é ambígua.' : 'Referência não encontrada.',
        });
        return null;
      }
      return matches[0] ?? null;
    };
    const required = (field: string, max?: number): string => {
      const value = values[field] ?? '';
      if (!value || (max && value.length > max)) {
        errors.push({
          row,
          field,
          message: !value ? 'Preencha este campo.' : `Use no máximo ${max} caracteres.`,
        });
      }
      return value;
    };
    const number = (field: string, minimum: number, maximum?: number): number => {
      const value = Number(values[field]);
      if (
        !Number.isInteger(value) ||
        value < minimum ||
        (maximum !== undefined && value > maximum)
      ) {
        errors.push({
          row,
          field,
          message:
            maximum === undefined
              ? `Informe um número inteiro maior ou igual a ${minimum}.`
              : `Informe um número inteiro entre ${minimum} e ${maximum}.`,
        });
      }
      return value;
    };
    const slug = required('slug', 100);
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errors.push({
        row,
        field: 'slug',
        message: 'Use letras minúsculas, números e hífens.',
      });
    }
    const position = required('position');
    if (!positions[position as CardPosition]) {
      errors.push({ row, field: 'position', message: 'Escolha uma posição válida.' });
    }
    const secondaryPositions = (values.secondaryPositions ?? '')
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      new Set(secondaryPositions).size !== secondaryPositions.length ||
      secondaryPositions.some((value) => !positions[value as CardPosition])
    ) {
      errors.push({
        row,
        field: 'secondaryPositions',
        message: 'Use posições válidas, sem repetir, separadas por ponto e vírgula.',
      });
    }
    const contractsBlocked = parseBoolean(values.contractsBlocked ?? '');
    if (contractsBlocked === null) {
      errors.push({ row, field: 'contractsBlocked', message: 'Escolha Sim ou Não.' });
    }
    const collectionId = getReference('collection', catalog.collectionNames);
    const teamId = getReference('team', catalog.teamNames);
    if (!slug || !collectionId || !teamId || contractsBlocked === null) return null;
    const errorCount = errors.length;
    const input: ImportRow = {
      slug,
      name: required('name', 100),
      collectionId,
      teamId,
      position: position as CardPosition,
      secondaryPositions: secondaryPositions as CardPosition[],
      contractsBlocked,
      defense: number('defense', 1),
      attack: number('attack', 1),
      creation: number('creation', 1),
      overall: number('overall', 60, 100),
      passing: number('passing', 1),
      control: number('control', 1),
      marking: number('marking', 1),
      pace: number('pace', 1),
      dribbling: number('dribbling', 1),
      finishing: number('finishing', 1),
    };
    return errors.length === errorCount ? input : null;
  }

  private async loadCatalog(): Promise<CatalogMaps> {
    const database = await this.database();
    const [collectionRows, teams] = await Promise.all([
      database.db
        .select({
          id: database.schema.collections.id,
          slug: database.schema.collections.slug,
          name: database.schema.localizedTextTranslations.content,
          emoji: database.schema.collections.emoji,
          imageUrl: database.schema.collections.imageUrl,
        })
        .from(database.schema.collections)
        .innerJoin(
          database.schema.localizedTextTranslations,
          database.and(
            database.eq(
              database.schema.localizedTextTranslations.localizedTextId,
              database.schema.collections.nameTextId,
            ),
            database.eq(database.schema.localizedTextTranslations.locale, 'pt-BR'),
          ),
        ),
      database.db
        .select({
          id: database.schema.teams.id,
          slug: database.schema.teams.slug,
          name: database.schema.teams.name,
          emoji: database.schema.teams.emoji,
          imageUrl: database.schema.teams.imageUrl,
        })
        .from(database.schema.teams),
    ]);
    const collections = collectionRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      emoji: row.emoji,
      imageUrl: row.imageUrl,
    }));
    return {
      collections,
      teams,
      collectionNames: nameMap(collections),
      teamNames: nameMap(teams),
    };
  }

  private async collection(collectionId: string): Promise<AdminCollection> {
    const database = await this.database();
    const [collection] = await database.db
      .select({
        id: database.schema.collections.id,
        name: database.schema.localizedTextTranslations.content,
        emoji: database.schema.collections.emoji,
        primaryColor: database.schema.collections.primaryColor,
        secondaryColor: database.schema.collections.secondaryColor,
        slug: database.schema.collections.slug,
        imageUrl: database.schema.collections.imageUrl,
        overlayUrl: database.schema.collections.overlayUrl,
        bannerUrl: database.schema.collections.bannerUrl,
        contractsBlocked: database.schema.collections.contractsBlocked,
      })
      .from(database.schema.collections)
      .innerJoin(
        database.schema.localizedTextTranslations,
        database.and(
          database.eq(
            database.schema.localizedTextTranslations.localizedTextId,
            database.schema.collections.nameTextId,
          ),
          database.eq(database.schema.localizedTextTranslations.locale, 'pt-BR'),
        ),
      )
      .where(database.eq(database.schema.collections.id, collectionId));
    if (!collection) throw new NotFoundException('Collection not found.');
    return collection;
  }

  private async cardById(cardId: string) {
    const database = await this.database();
    const [card] = await database.db
      .select()
      .from(database.schema.cards)
      .where(database.eq(database.schema.cards.id, cardId));
    if (!card) throw new NotFoundException('Card not found.');
    return card;
  }

  private async positionsByCard(ids: string[]): Promise<Map<string, CardPosition[]>> {
    const database = await this.database();
    if (!ids.length) return new Map();
    const rows = await database.db
      .select()
      .from(database.schema.cardSecondaryPositions)
      .where(database.inArray(database.schema.cardSecondaryPositions.cardId, ids));
    const result = new Map<string, CardPosition[]>();
    for (const row of rows)
      result.set(row.cardId, [...(result.get(row.cardId) ?? []), row.position]);
    return result;
  }

  private async statisticsById(ids: string[]) {
    const database = await this.database();
    if (!ids.length)
      return new Map<
        string,
        {
          passing: number;
          control: number;
          marking: number;
          pace: number;
          dribbling: number;
          finishing: number;
        }
      >();
    const rows = await database.db
      .select()
      .from(database.schema.cardStats)
      .where(database.inArray(database.schema.cardStats.id, ids));
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toCard(
    card: Awaited<ReturnType<AdminCardsService['cardById']>>,
    catalog: CatalogMaps,
    positionsByCard: Map<string, CardPosition[]>,
    statisticsById: Map<
      string,
      {
        passing: number;
        control: number;
        marking: number;
        pace: number;
        dribbling: number;
        finishing: number;
      }
    >,
    defaultImageUrl: string,
  ): AdminCard {
    const collection = catalog.collections.find((entry) => entry.id === card.collectionId);
    const team = catalog.teams.find((entry) => entry.id === card.teamId);
    if (!collection || !team) throw new Error('Card references are invalid.');
    const statistics = statisticsById.get(card.statsId);
    if (!statistics) throw new Error('Card statistics are invalid.');
    return {
      id: card.id,
      slug: card.slug,
      name: card.name,
      collection,
      team,
      position: card.position,
      secondaryPositions: positionsByCard.get(card.id) ?? [],
      contractsBlocked: card.contractsBlocked,
      defense: card.defense,
      attack: card.attack,
      creation: card.creation,
      overall: card.overall,
      passing: statistics.passing,
      control: statistics.control,
      marking: statistics.marking,
      pace: statistics.pace,
      dribbling: statistics.dribbling,
      finishing: statistics.finishing,
      imageUrl: card.imageUrl ?? defaultImageUrl,
    };
  }

  private async database(): Promise<Database> {
    return import('@futhub/database');
  }
}

function stats(
  input: Pick<CardInput, 'passing' | 'control' | 'marking' | 'pace' | 'dribbling' | 'finishing'>,
) {
  return {
    passing: input.passing,
    control: input.control,
    marking: input.marking,
    pace: input.pace,
    dribbling: input.dribbling,
    finishing: input.finishing,
  };
}

function cardValues(input: Omit<CardInput, 'slug'>) {
  return {
    name: input.name,
    collectionId: input.collectionId,
    teamId: input.teamId,
    position: input.position,
    contractsBlocked: input.contractsBlocked ?? false,
    defense: input.defense,
    attack: input.attack,
    creation: input.creation,
    overall: input.overall,
  };
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function nameMap(entries: CardReference[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const entry of entries)
    result.set(normalize(entry.name), [...(result.get(normalize(entry.name)) ?? []), entry.id]);
  return result;
}

function parseBoolean(value: string): boolean | null {
  const normalized = normalize(value);
  if (normalized === 'sim') return true;
  if (normalized === 'não' || normalized === 'nao') return false;
  return null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
}

function assertSvgTeamLogo(imageUrl: string | null | undefined): void {
  if (!imageUrl) return;
  try {
    const url = new URL(imageUrl);
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname.toLowerCase().endsWith('.svg')
    )
      return;
  } catch {
    // Handled by the common validation error below.
  }
  throw new BadRequestException('Team image must be an HTTP(S) SVG URL.');
}
