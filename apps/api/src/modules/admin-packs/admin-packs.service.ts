import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { type FileDto, FilesService, type ImageFile } from '../files/files.service.js';
import type {
  AdminPack,
  AdminPackConfigInput,
  AdminPackInput,
  AdminPackPresentationInput,
} from './admin-packs.dto.js';

type Database = typeof import('@futhub/database');

@Injectable()
export class AdminPacksService {
  constructor(@Inject(FilesService) private readonly files: FilesService) {}

  private database(): Promise<Database> {
    return import('@futhub/database');
  }

  async list(): Promise<AdminPack[]> {
    const database = await this.database();
    const { db, schema } = database;
    const rows = await db.select().from(schema.packs).orderBy(schema.packs.name);
    return Promise.all(rows.map((row) => this.read(database, row.id)));
  }

  async create(input: AdminPackInput): Promise<AdminPack> {
    this.validate(input.config);
    const image = await this.importImage(input.imageUrl);
    const database = await this.database();
    const { db, schema } = database;
    let id: string;
    try {
      id = await db.transaction(async (tx) => {
        const [config] = await tx
          .insert(schema.packConfigs)
          .values(this.configValues(input.config))
          .returning({ id: schema.packConfigs.id });
        if (!config) throw new Error('Failed to create pack config.');
        const [pack] = await tx
          .insert(schema.packs)
          .values({
            ...this.packValues(input),
            imageFileId: image?.id ?? null,
            configId: config.id,
          })
          .returning({ id: schema.packs.id });
        if (!pack) throw new Error('Failed to create pack.');
        await this.replaceFilters(database, tx, config.id, input.config);
        if (input.presentation)
          await tx
            .insert(schema.packPresentations)
            .values({ packId: pack.id, ...this.presentationValues(input.presentation) });
        return pack.id;
      });
    } catch (error) {
      await this.removeFile(image);
      throw error;
    }
    return this.read(database, id);
  }

  async update(id: string, input: AdminPackInput): Promise<AdminPack> {
    this.validate(input.config);
    const database = await this.database();
    const { db, eq, schema } = database;
    const [current] = await db
      .select({ imageFileId: schema.packs.imageFileId })
      .from(schema.packs)
      .where(eq(schema.packs.id, id));
    if (!current) throw new NotFoundException('Pack not found.');
    const image = await this.importImage(input.imageUrl);
    try {
      await db.transaction(async (tx) => {
        const [pack] = await tx
          .select({ configId: schema.packs.configId })
          .from(schema.packs)
          .where(eq(schema.packs.id, id));
        if (!pack) throw new NotFoundException('Pack not found.');
        await tx
          .update(schema.packs)
          .set({ ...this.packValues(input), imageFileId: image?.id ?? null })
          .where(eq(schema.packs.id, id));
        await tx
          .update(schema.packConfigs)
          .set(this.configValues(input.config))
          .where(eq(schema.packConfigs.id, pack.configId));
        await this.replaceFilters(database, tx, pack.configId, input.config);
        if (input.presentation)
          await tx
            .insert(schema.packPresentations)
            .values({ packId: id, ...this.presentationValues(input.presentation) })
            .onConflictDoUpdate({
              target: schema.packPresentations.packId,
              set: this.presentationValues(input.presentation),
            });
      });
    } catch (error) {
      await this.removeFile(image);
      throw error;
    }
    await this.files.removeIfUnused(current.imageFileId);
    return this.read(database, id);
  }

  async uploadImage(id: string, image: ImageFile): Promise<AdminPack> {
    const database = await this.database();
    const { db, eq, schema } = database;
    const [pack] = await db
      .select({ imageFileId: schema.packs.imageFileId })
      .from(schema.packs)
      .where(eq(schema.packs.id, id));
    if (!pack) throw new NotFoundException('Pack not found.');
    const file = await this.files.upload(image);
    await db.update(schema.packs).set({ imageFileId: file.id }).where(eq(schema.packs.id, id));
    await this.files.removeIfUnused(pack.imageFileId);
    return this.read(database, id);
  }

  async disable(id: string): Promise<AdminPack> {
    const database = await this.database();
    const { db, eq, schema } = database;
    const [pack] = await db
      .update(schema.packs)
      .set({ canBuy: false })
      .where(eq(schema.packs.id, id))
      .returning({ id: schema.packs.id });
    if (!pack) throw new NotFoundException('Pack not found.');
    return this.read(database, pack.id);
  }

  private validate(config: AdminPackConfigInput) {
    if (config.minOverall > config.maxOverall)
      throw new BadRequestException('minOverall must not exceed maxOverall.');
    const filterPairs = [
      [config.onlyPositions, config.excludedPositions],
      [config.onlyCollectionIds, config.excludedCollectionIds],
      [config.onlyCardIds, config.excludedCardIds],
      [config.onlyTeamIds, config.excludedTeamIds],
    ] as const;
    if (filterPairs.some(([included, excluded]) => included.length && excluded.length))
      throw new BadRequestException('Each filter category must include or block items, not both.');
  }

  private packValues(input: AdminPackInput) {
    return {
      name: input.name,
      color: input.color,
      emoji: input.emoji,
      cardsAmount: input.cardsAmount,
      price: input.price,
      canBuy: input.canBuy,
      limitPerUser: input.limitPerUser,
    };
  }

  private importImage(sourceUrl: string | null): Promise<FileDto | null> {
    return sourceUrl ? this.files.importImage(sourceUrl) : Promise.resolve(null);
  }

  private removeFile(file: FileDto | null): Promise<void> {
    return this.files.removeIfUnused(file?.id ?? null);
  }

  private configValues(input: AdminPackConfigInput) {
    return { name: input.name, minOverall: input.minOverall, maxOverall: input.maxOverall };
  }

  private presentationValues(input: AdminPackPresentationInput) {
    return {
      schemaVersion: input.schemaVersion,
      color: input.color,
      accentColor: input.accentColor,
      textColor: input.textColor,
      effect: input.effect,
      texture: input.texture,
      textureOpacity: input.textureOpacity,
      tintOpacity: input.tintOpacity,
      headline: input.headline,
      headlineSize: input.headlineSize,
      headlineX: input.headlineX,
      headlineY: input.headlineY,
      kicker: input.kicker,
      kickerX: input.kickerX,
      kickerY: input.kickerY,
    };
  }

  private async replaceFilters(
    database: Database,
    tx: Parameters<Parameters<Database['db']['transaction']>[0]>[0],
    configId: string,
    input: AdminPackConfigInput,
  ) {
    const { eq, schema } = database;
    await tx
      .delete(schema.packConfigOnlyPositions)
      .where(eq(schema.packConfigOnlyPositions.configId, configId));
    await tx
      .delete(schema.packConfigExcludedPositions)
      .where(eq(schema.packConfigExcludedPositions.configId, configId));
    await tx
      .delete(schema.packConfigOnlyCollections)
      .where(eq(schema.packConfigOnlyCollections.configId, configId));
    await tx
      .delete(schema.packConfigExcludedCollections)
      .where(eq(schema.packConfigExcludedCollections.configId, configId));
    await tx
      .delete(schema.packConfigOnlyCards)
      .where(eq(schema.packConfigOnlyCards.configId, configId));
    await tx
      .delete(schema.packConfigExcludedCards)
      .where(eq(schema.packConfigExcludedCards.configId, configId));
    await tx
      .delete(schema.packConfigOnlyTeams)
      .where(eq(schema.packConfigOnlyTeams.configId, configId));
    await tx
      .delete(schema.packConfigExcludedTeams)
      .where(eq(schema.packConfigExcludedTeams.configId, configId));
    if (input.onlyPositions.length)
      await tx
        .insert(schema.packConfigOnlyPositions)
        .values(input.onlyPositions.map((position) => ({ configId, position })));
    if (input.excludedPositions.length)
      await tx
        .insert(schema.packConfigExcludedPositions)
        .values(input.excludedPositions.map((position) => ({ configId, position })));
    if (input.onlyCollectionIds.length)
      await tx
        .insert(schema.packConfigOnlyCollections)
        .values(input.onlyCollectionIds.map((collectionId) => ({ configId, collectionId })));
    if (input.excludedCollectionIds.length)
      await tx
        .insert(schema.packConfigExcludedCollections)
        .values(input.excludedCollectionIds.map((collectionId) => ({ configId, collectionId })));
    if (input.onlyCardIds.length)
      await tx
        .insert(schema.packConfigOnlyCards)
        .values(input.onlyCardIds.map((cardId) => ({ configId, cardId })));
    if (input.excludedCardIds.length)
      await tx
        .insert(schema.packConfigExcludedCards)
        .values(input.excludedCardIds.map((cardId) => ({ configId, cardId })));
    if (input.onlyTeamIds.length)
      await tx
        .insert(schema.packConfigOnlyTeams)
        .values(input.onlyTeamIds.map((teamId) => ({ configId, teamId })));
    if (input.excludedTeamIds.length)
      await tx
        .insert(schema.packConfigExcludedTeams)
        .values(input.excludedTeamIds.map((teamId) => ({ configId, teamId })));
  }

  private async read(database: Database, id: string): Promise<AdminPack> {
    const { db, eq, schema } = database;
    const [row] = await db
      .select()
      .from(schema.packs)
      .innerJoin(schema.packConfigs, eq(schema.packs.configId, schema.packConfigs.id))
      .leftJoin(schema.packPresentations, eq(schema.packs.id, schema.packPresentations.packId))
      .where(eq(schema.packs.id, id));
    if (!row) throw new NotFoundException('Pack not found.');
    const configId = row.pack_configs.id;
    const onlyPositions = (
      await db
        .select()
        .from(schema.packConfigOnlyPositions)
        .where(eq(schema.packConfigOnlyPositions.configId, configId))
    ).map(({ position }) => position);
    const excludedPositions = (
      await db
        .select()
        .from(schema.packConfigExcludedPositions)
        .where(eq(schema.packConfigExcludedPositions.configId, configId))
    ).map(({ position }) => position);
    const onlyCollectionIds = (
      await db
        .select()
        .from(schema.packConfigOnlyCollections)
        .where(eq(schema.packConfigOnlyCollections.configId, configId))
    ).map(({ collectionId }) => collectionId);
    const excludedCollectionIds = (
      await db
        .select()
        .from(schema.packConfigExcludedCollections)
        .where(eq(schema.packConfigExcludedCollections.configId, configId))
    ).map(({ collectionId }) => collectionId);
    const onlyCardIds = (
      await db
        .select()
        .from(schema.packConfigOnlyCards)
        .where(eq(schema.packConfigOnlyCards.configId, configId))
    ).map(({ cardId }) => cardId);
    const excludedCardIds = (
      await db
        .select()
        .from(schema.packConfigExcludedCards)
        .where(eq(schema.packConfigExcludedCards.configId, configId))
    ).map(({ cardId }) => cardId);
    const onlyTeamIds = (
      await db
        .select()
        .from(schema.packConfigOnlyTeams)
        .where(eq(schema.packConfigOnlyTeams.configId, configId))
    ).map(({ teamId }) => teamId);
    const excludedTeamIds = (
      await db
        .select()
        .from(schema.packConfigExcludedTeams)
        .where(eq(schema.packConfigExcludedTeams.configId, configId))
    ).map(({ teamId }) => teamId);
    const imageUrls = await this.files.urls(row.packs.imageFileId ? [row.packs.imageFileId] : []);
    const { imageFileId, imageUrl: _, ...pack } = row.packs;
    return {
      ...pack,
      imageUrl: imageFileId ? (imageUrls.get(imageFileId) ?? null) : null,
      presentation: row.pack_presentations,
      config: {
        ...row.pack_configs,
        onlyPositions,
        excludedPositions,
        onlyCollectionIds,
        excludedCollectionIds,
        onlyCardIds,
        excludedCardIds,
        onlyTeamIds,
        excludedTeamIds,
      },
    };
  }
}
