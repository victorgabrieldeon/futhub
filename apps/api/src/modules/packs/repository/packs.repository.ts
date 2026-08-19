import type * as DatabaseModule from '@dreamfut/database';

import type {
  DiscordIdentity,
  OpenTransaction,
  PackRepository,
  PurchaseTransaction,
} from '../packs.types.js';

type Database = typeof DatabaseModule;
type DatabaseLoader = () => Promise<Database>;

export class DrizzlePackRepository implements PackRepository {
  constructor(private readonly loadDatabase: DatabaseLoader) {}

  async runPurchase<T>(
    identity: DiscordIdentity,
    packId: string,
    operation: (transaction: PurchaseTransaction) => Promise<T>,
  ): Promise<T> {
    const { db, eq, sql, schema } = await this.loadDatabase();
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`pack:${identity.id}:${packId}`}))`,
      );
      const [user] = await tx
        .insert(schema.users)
        .values({ discordUserId: identity.id, nome: identity.name, urlAvatar: identity.avatarUrl })
        .onConflictDoUpdate({
          target: schema.users.discordUserId,
          set: { nome: identity.name, urlAvatar: identity.avatarUrl, atualizadoEm: new Date() },
        })
        .returning({ id: schema.users.id, balance: schema.users.saldo });
      if (!user) throw new Error('Failed to load user.');
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
      await tx.insert(schema.gameSettings).values({ singleton: true }).onConflictDoNothing();
      const [settings] = await tx
        .select({ maxCards: schema.gameSettings.maxCardsPerUser })
        .from(schema.gameSettings)
        .limit(1);
      if (!settings) throw new Error('Game settings unavailable.');
      const cardCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.userCards)
        .where(eq(schema.userCards.userId, user.id));
      const count = cardCount[0]?.count;
      if (count === undefined) throw new Error('Failed to count user cards.');
      return operation({
        canBuy: pack.canBuy,
        balance: user.balance,
        ownedQuantity: current?.quantity ?? 0,
        limitPerUser: pack.limit,
        cardCount: count,
        maxCards: settings.maxCards,
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
    const { and, asc, db, eq, gte, inArray, lte, notInArray, sql, schema } =
      await this.loadDatabase();
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`pack:${identity.id}:${packId}`}))`,
      );
      const [user] = await tx
        .insert(schema.users)
        .values({ discordUserId: identity.id, nome: identity.name, urlAvatar: identity.avatarUrl })
        .onConflictDoUpdate({
          target: schema.users.discordUserId,
          set: { nome: identity.name, urlAvatar: identity.avatarUrl, atualizadoEm: new Date() },
        })
        .returning({ id: schema.users.id });
      if (!user) throw new Error('Failed to load user.');
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
      await tx.insert(schema.gameSettings).values({ singleton: true }).onConflictDoNothing();
      const [settings] = await tx
        .select({ maxCards: schema.gameSettings.maxCardsPerUser })
        .from(schema.gameSettings)
        .limit(1);
      if (!settings) throw new Error('Game settings unavailable.');
      const cardCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.userCards)
        .where(eq(schema.userCards.userId, user.id));
      const count = cardCount[0]?.count;
      if (count === undefined) throw new Error('Failed to count user cards.');
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
        cardCount: count,
        maxCards: settings.maxCards,
        cardsAmount: pack.cardsAmount,
        candidates,
        probabilities,
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
