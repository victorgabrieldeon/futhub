import type * as DatabaseModule from '@futhub/database';

import { advanceMissions } from '../../missions/missions.service.js';
import { grantCommandXp } from '../../progression/progression.js';
import { cardInventoryCapacity, upsertDiscordUser } from '../../users/user.repository.js';
import type { PackCatalogItem } from '../packs.dto.js';
import type {
  DiscordIdentity,
  OpenTransaction,
  PackCatalogRepository,
  PackRepository,
  PurchaseTransaction,
} from '../use-cases/pack.types.js';

type Database = typeof DatabaseModule;
type DatabaseLoader = () => Promise<Database>;

export class DrizzlePackRepository implements PackCatalogRepository, PackRepository {
  constructor(private readonly loadDatabase: DatabaseLoader) {}

  async listAvailable(): Promise<readonly PackCatalogItem[]> {
    const { asc, db, eq, schema } = await this.loadDatabase();
    return db
      .select({
        id: schema.packs.id,
        name: schema.packs.name,
        emoji: schema.packs.emoji,
        cardsAmount: schema.packs.cardsAmount,
        price: schema.packs.price,
        limitPerUser: schema.packs.limitPerUser,
      })
      .from(schema.packs)
      .where(eq(schema.packs.canBuy, true))
      .orderBy(asc(schema.packs.name));
  }

  async runPurchase<T>(
    identity: DiscordIdentity,
    packId: string,
    operation: (transaction: PurchaseTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await this.loadDatabase();
    const { db, eq, sql, schema } = database;
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`pack:${identity.id}:${packId}`}))`,
      );
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      const [pack] = await tx
        .select({
          id: schema.packs.id,
          price: schema.packs.price,
          canBuy: schema.packs.canBuy,
          limit: schema.packs.limitPerUser,
        })
        .from(schema.packs)
        .where(eq(schema.packs.id, packId));
      if (!pack) throw new Error('Pack not found.');
      const current = await tx.query.userPacks.findFirst({
        columns: { quantity: true },
        where: (row, { and, eq }) => and(eq(row.userId, user.id), eq(row.packId, pack.id)),
      });
      const inventory = await cardInventoryCapacity(database, tx, user.id);
      return operation({
        canBuy: pack.canBuy,
        balance: user.balance,
        ownedQuantity: current?.quantity ?? 0,
        limitPerUser: pack.limit,
        cardCount: inventory.cardCount,
        maxCards: inventory.maxCards,
        price: pack.price,
        commit: async () => {
          const [credited] = await tx
            .update(schema.users)
            .set({ saldo: sql`${schema.users.saldo} - ${pack.price}`, atualizadoEm: new Date() })
            .where(eq(schema.users.id, user.id))
            .returning({ balance: schema.users.saldo });
          if (!credited) throw new Error('Failed to debit user.');
          const [inventory] = await tx
            .insert(schema.userPacks)
            .values({ userId: user.id, packId: pack.id, quantity: 1 })
            .onConflictDoUpdate({
              target: [schema.userPacks.userId, schema.userPacks.packId],
              set: { quantity: sql`${schema.userPacks.quantity} + 1` },
            })
            .returning({ quantity: schema.userPacks.quantity });
          if (!inventory) throw new Error('Failed to add pack.');
          await tx
            .insert(schema.transactionHistory)
            .values({ userId: user.id, type: 'purchase', amount: -pack.price });
          return { balance: credited.balance, quantity: inventory.quantity };
        },
      });
    });
  }

  async runOpen<T>(
    identity: DiscordIdentity,
    packId: string,
    operation: (transaction: OpenTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await this.loadDatabase();
    const { and, asc, db, eq, gte, inArray, lte, notInArray, sql, schema } = database;
    const now = new Date();
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`pack:${identity.id}:${packId}`}))`,
      );
      const user = await upsertDiscordUser(tx, schema, identity, now);
      const [pack] = await tx
        .select({
          id: schema.packs.id,
          cardsAmount: schema.packs.cardsAmount,
          configId: schema.packs.configId,
          minOverall: schema.packConfigs.minOverall,
          maxOverall: schema.packConfigs.maxOverall,
        })
        .from(schema.packs)
        .innerJoin(schema.packConfigs, eq(schema.packs.configId, schema.packConfigs.id))
        .where(eq(schema.packs.id, packId));
      if (!pack) throw new Error('Pack not found.');
      const owned = await tx.query.userPacks.findFirst({
        columns: { quantity: true },
        where: (row, { and, eq }) => and(eq(row.userId, user.id), eq(row.packId, pack.id)),
      });
      const inventory = await cardInventoryCapacity(database, tx, user.id);
      const [
        onlyCards,
        excludedCards,
        onlyCollections,
        excludedCollections,
        onlyTeams,
        excludedTeams,
        onlyPositions,
        excludedPositions,
      ] = await Promise.all([
        tx
          .select({ id: schema.packConfigOnlyCards.cardId })
          .from(schema.packConfigOnlyCards)
          .where(eq(schema.packConfigOnlyCards.configId, pack.configId)),
        tx
          .select({ id: schema.packConfigExcludedCards.cardId })
          .from(schema.packConfigExcludedCards)
          .where(eq(schema.packConfigExcludedCards.configId, pack.configId)),
        tx
          .select({ id: schema.packConfigOnlyCollections.collectionId })
          .from(schema.packConfigOnlyCollections)
          .where(eq(schema.packConfigOnlyCollections.configId, pack.configId)),
        tx
          .select({ id: schema.packConfigExcludedCollections.collectionId })
          .from(schema.packConfigExcludedCollections)
          .where(eq(schema.packConfigExcludedCollections.configId, pack.configId)),
        tx
          .select({ id: schema.packConfigOnlyTeams.teamId })
          .from(schema.packConfigOnlyTeams)
          .where(eq(schema.packConfigOnlyTeams.configId, pack.configId)),
        tx
          .select({ id: schema.packConfigExcludedTeams.teamId })
          .from(schema.packConfigExcludedTeams)
          .where(eq(schema.packConfigExcludedTeams.configId, pack.configId)),
        tx
          .select({ id: schema.packConfigOnlyPositions.position })
          .from(schema.packConfigOnlyPositions)
          .where(eq(schema.packConfigOnlyPositions.configId, pack.configId)),
        tx
          .select({ id: schema.packConfigExcludedPositions.position })
          .from(schema.packConfigExcludedPositions)
          .where(eq(schema.packConfigExcludedPositions.configId, pack.configId)),
      ]);
      const only = <T extends { id: string }>(rows: readonly T[]) => rows.map((row) => row.id);
      const conditions = [
        gte(schema.cards.overall, pack.minOverall),
        lte(schema.cards.overall, pack.maxOverall),
      ];
      const onlyCardIds = only(onlyCards);
      if (onlyCardIds.length) conditions.push(inArray(schema.cards.id, onlyCardIds));
      const excludedCardIds = only(excludedCards);
      if (excludedCardIds.length) conditions.push(notInArray(schema.cards.id, excludedCardIds));
      const onlyCollectionIds = only(onlyCollections);
      if (onlyCollectionIds.length)
        conditions.push(inArray(schema.cards.collectionId, onlyCollectionIds));
      const excludedCollectionIds = only(excludedCollections);
      if (excludedCollectionIds.length)
        conditions.push(notInArray(schema.cards.collectionId, excludedCollectionIds));
      const onlyTeamIds = only(onlyTeams);
      if (onlyTeamIds.length) conditions.push(inArray(schema.cards.teamId, onlyTeamIds));
      const excludedTeamIds = only(excludedTeams);
      if (excludedTeamIds.length) conditions.push(notInArray(schema.cards.teamId, excludedTeamIds));
      const onlyPositionsValues = onlyPositions.map((row) => row.id);
      if (onlyPositionsValues.length)
        conditions.push(inArray(schema.cards.position, onlyPositionsValues));
      const excludedPositionValues = excludedPositions.map((row) => row.id);
      if (excludedPositionValues.length)
        conditions.push(notInArray(schema.cards.position, excludedPositionValues));
      const candidates = await tx
        .select({ id: schema.cards.id, overall: schema.cards.overall })
        .from(schema.cards)
        .where(and(...conditions))
        .orderBy(asc(schema.cards.id));
      const probabilities = await tx
        .select({
          overall: schema.packProbabilities.overall,
          weight: schema.packProbabilities.probability,
        })
        .from(schema.packProbabilityLinks)
        .innerJoin(
          schema.packProbabilities,
          eq(schema.packProbabilityLinks.probabilityId, schema.packProbabilities.id),
        )
        .where(eq(schema.packProbabilityLinks.packId, pack.id));
      return operation({
        ownedQuantity: owned?.quantity ?? 0,
        cardCount: inventory.cardCount,
        maxCards: inventory.maxCards,
        cardsAmount: pack.cardsAmount,
        candidates,
        probabilities,
        grantProgression: () => grantCommandXp(database, tx, user.id, 'open_pack', now),
        commit: async (selected) => {
          const created = await tx
            .insert(schema.userCards)
            .values(selected.map((card) => ({ userId: user.id, cardId: card.id })))
            .returning({ id: schema.userCards.id });
          if (created.length !== selected.length) throw new Error('Failed to create user cards.');
          await tx
            .update(schema.userPacks)
            .set({ quantity: sql`${schema.userPacks.quantity} - 1` })
            .where(and(eq(schema.userPacks.userId, user.id), eq(schema.userPacks.packId, pack.id)));
          await advanceMissions(database, tx, user.id, 'open_pack', now);
          return created.map((userCard, index) => {
            const card = selected[index];
            if (!card) throw new Error('Failed to map created card.');
            return { id: userCard.id, card };
          });
        },
      });
    });
  }
}
