import type * as DatabaseModule from '@futhub/database';

import type { FilesService } from '../../files/files.service.js';
import { advanceMissions } from '../../missions/missions.service.js';
import { cardInventoryCapacity, upsertDiscordUser } from '../../users/user.repository.js';
import { CardMarketRepository } from '../use-cases/card-market.types.js';
import type {
  DiscordIdentity,
  ListCardsItem,
  ListCardsQuery,
  ListCardsResult,
  ListCatalogResult,
  PurchaseCardTransaction,
  SaleCardsTransaction,
} from '../use-cases/card-market.types.js';

const basisPoints = 10_000n;
const maxBalance = 2_147_483_647n;
const pageSize = 10 as const;

type Database = typeof DatabaseModule;
type DatabaseLoader = () => Promise<Database>;

function marketPrice(price: number, multiplierBasisPoints: number): number {
  const result = (BigInt(price) * BigInt(multiplierBasisPoints)) / basisPoints;
  if (result > maxBalance) throw new Error('Card market price exceeds balance limit.');
  return Number(result);
}

export class DrizzleCardMarketRepository extends CardMarketRepository {
  constructor(
    private readonly loadDatabase: DatabaseLoader,
    private readonly files: FilesService,
  ) {
    super();
  }

  async listCards(query: ListCardsQuery): Promise<ListCardsResult> {
    const database = await this.loadDatabase();
    const { and, asc, db, desc, eq, gte, inArray, lte, sql, schema } = database;
    const positionValues = query.positions?.map((position) => sql`${position}::card_position`);
    const positionFilter = positionValues
      ? sql<boolean>`(
          ${schema.cards.position} in (${sql.join(positionValues, sql`, `)})
          or exists (
            select 1 from ${schema.cardSecondaryPositions}
            where ${schema.cardSecondaryPositions.cardId} = ${schema.cards.id}
              and ${schema.cardSecondaryPositions.position} in (${sql.join(positionValues, sql`, `)})
          )
        )`
      : undefined;
    const filter = and(
      eq(schema.cards.contractsBlocked, false),
      eq(schema.collections.contractsBlocked, false),
      gte(schema.cards.overall, query.minOverall),
      lte(schema.cards.overall, query.maxOverall),
      query.teamId ? eq(schema.cards.teamId, query.teamId) : undefined,
      query.collectionId ? eq(schema.cards.collectionId, query.collectionId) : undefined,
      positionFilter,
    );
    const translationJoin = and(
      eq(schema.localizedTextTranslations.localizedTextId, schema.collections.nameTextId),
      eq(schema.localizedTextTranslations.locale, 'pt-BR'),
    );
    const count = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.cards)
      .innerJoin(schema.collections, eq(schema.cards.collectionId, schema.collections.id))
      .innerJoin(schema.localizedTextTranslations, translationJoin)
      .innerJoin(schema.cardPriceConfigs, eq(schema.cards.overall, schema.cardPriceConfigs.overall))
      .where(filter);
    const total = count[0]?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);
    const page = totalPages === 0 ? 1 : Math.min(query.page, totalPages);
    if (total === 0) return { items: [], total, page, pageSize, totalPages };

    const ordering =
      query.sort === 'overall'
        ? [desc(schema.cards.overall), asc(schema.cards.name), asc(schema.cards.id)]
        : query.sort === 'name'
          ? [asc(schema.cards.name), asc(schema.cards.id)]
          : [desc(schema.cards.createdAt), asc(schema.cards.id)];
    const rows = await db
      .select({
        id: schema.cards.id,
        name: schema.cards.name,
        imageFileId: schema.cards.imageFileId,
        overall: schema.cards.overall,
        position: schema.cards.position,
        defense: schema.cards.defense,
        attack: schema.cards.attack,
        creation: schema.cards.creation,
        passing: schema.cardStats.passing,
        control: schema.cardStats.control,
        marking: schema.cardStats.marking,
        pace: schema.cardStats.pace,
        dribbling: schema.cardStats.dribbling,
        finishing: schema.cardStats.finishing,
        basePrice: schema.cardPriceConfigs.price,
        teamId: schema.teams.id,
        teamName: schema.teams.name,
        teamEmoji: schema.teams.emoji,
        collectionId: schema.collections.id,
        collectionName: schema.localizedTextTranslations.content,
        collectionEmoji: schema.collections.emoji,
      })
      .from(schema.cards)
      .innerJoin(schema.cardStats, eq(schema.cards.statsId, schema.cardStats.id))
      .innerJoin(schema.teams, eq(schema.cards.teamId, schema.teams.id))
      .innerJoin(schema.collections, eq(schema.cards.collectionId, schema.collections.id))
      .innerJoin(schema.localizedTextTranslations, translationJoin)
      .innerJoin(schema.cardPriceConfigs, eq(schema.cards.overall, schema.cardPriceConfigs.overall))
      .where(filter)
      .orderBy(...ordering)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const cardIds = rows.map((row) => row.id);
    const secondaryRows = await db
      .select({
        cardId: schema.cardSecondaryPositions.cardId,
        position: schema.cardSecondaryPositions.position,
      })
      .from(schema.cardSecondaryPositions)
      .where(inArray(schema.cardSecondaryPositions.cardId, cardIds))
      .orderBy(
        asc(schema.cardSecondaryPositions.cardId),
        asc(schema.cardSecondaryPositions.position),
      );
    const secondaryPositions = new Map<string, ListCardsItem['secondaryPositions']>();
    for (const row of secondaryRows) {
      secondaryPositions.set(row.cardId, [
        ...(secondaryPositions.get(row.cardId) ?? []),
        row.position,
      ]);
    }
    const imageUrls = await this.files.urls(
      rows.flatMap((row) => (row.imageFileId ? [row.imageFileId] : [])),
    );
    const defaultImageUrl = rows.some((row) => !row.imageFileId)
      ? (await this.files.defaultCardImage()).url
      : '';
    const config = await db.query.cardMarketConfig.findFirst({
      columns: { buyMultiplierBasisPoints: true },
    });
    if (!config) throw new Error('Card market configuration is unavailable.');
    const items = rows.map(
      (row): ListCardsItem => ({
        id: row.id,
        name: row.name,
        imageUrl: row.imageFileId
          ? (imageUrls.get(row.imageFileId) ?? defaultImageUrl)
          : defaultImageUrl,
        overall: row.overall,
        position: row.position,
        secondaryPositions: secondaryPositions.get(row.id) ?? [],
        defense: row.defense,
        attack: row.attack,
        creation: row.creation,
        passing: row.passing,
        control: row.control,
        marking: row.marking,
        pace: row.pace,
        dribbling: row.dribbling,
        finishing: row.finishing,
        price: marketPrice(row.basePrice, config.buyMultiplierBasisPoints),
        team: { id: row.teamId, name: row.teamName, emoji: row.teamEmoji },
        collection: {
          id: row.collectionId,
          name: row.collectionName,
          emoji: row.collectionEmoji,
        },
      }),
    );
    return { items, total, page, pageSize, totalPages };
  }

  async listCatalog(): Promise<ListCatalogResult> {
    const database = await this.loadDatabase();
    const { and, asc, db, eq, schema } = database;
    const eligible = and(
      eq(schema.cards.contractsBlocked, false),
      eq(schema.collections.contractsBlocked, false),
    );
    const translationJoin = and(
      eq(schema.localizedTextTranslations.localizedTextId, schema.collections.nameTextId),
      eq(schema.localizedTextTranslations.locale, 'pt-BR'),
    );
    const [teams, collections] = await Promise.all([
      db
        .selectDistinct({ id: schema.teams.id, name: schema.teams.name, emoji: schema.teams.emoji })
        .from(schema.cards)
        .innerJoin(schema.teams, eq(schema.cards.teamId, schema.teams.id))
        .innerJoin(schema.collections, eq(schema.cards.collectionId, schema.collections.id))
        .innerJoin(schema.localizedTextTranslations, translationJoin)
        .innerJoin(
          schema.cardPriceConfigs,
          eq(schema.cards.overall, schema.cardPriceConfigs.overall),
        )
        .where(eligible)
        .orderBy(asc(schema.teams.name), asc(schema.teams.id)),
      db
        .selectDistinct({
          id: schema.collections.id,
          name: schema.localizedTextTranslations.content,
          emoji: schema.collections.emoji,
        })
        .from(schema.cards)
        .innerJoin(schema.collections, eq(schema.cards.collectionId, schema.collections.id))
        .innerJoin(schema.localizedTextTranslations, translationJoin)
        .innerJoin(
          schema.cardPriceConfigs,
          eq(schema.cards.overall, schema.cardPriceConfigs.overall),
        )
        .where(eligible)
        .orderBy(asc(schema.localizedTextTranslations.content), asc(schema.collections.id)),
    ]);
    return { teams, collections };
  }

  async runPurchase<T>(
    identity: DiscordIdentity,
    cardId: string,
    operation: (transaction: PurchaseCardTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await this.loadDatabase();
    const { and, db, eq, gte, sql, schema } = database;
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`card-market:${identity.id}`}))`,
      );
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      const [card] = await tx
        .select({
          overall: schema.cards.overall,
          cardContractsBlocked: schema.cards.contractsBlocked,
          collectionContractsBlocked: schema.collections.contractsBlocked,
        })
        .from(schema.cards)
        .innerJoin(schema.collections, eq(schema.cards.collectionId, schema.collections.id))
        .where(eq(schema.cards.id, cardId));
      if (!card)
        return operation({
          cardExists: false,
          contractsBlocked: false,
          balance: user.balance,
          cardCount: 0,
          maxCards: 0,
          price: 0,
          commit: async () => {
            throw new Error('Card not found.');
          },
        });
      const [priceConfig, marketConfig, inventory] = await Promise.all([
        tx.query.cardPriceConfigs.findFirst({
          columns: { price: true },
          where: eq(schema.cardPriceConfigs.overall, card.overall),
        }),
        this.marketConfig(tx, schema),
        cardInventoryCapacity(database, tx, user.id),
      ]);
      if (!priceConfig) throw new Error('Card price is unavailable.');
      const price = marketPrice(priceConfig.price, marketConfig.buyMultiplierBasisPoints);
      return operation({
        cardExists: true,
        contractsBlocked: card.cardContractsBlocked || card.collectionContractsBlocked,
        balance: user.balance,
        cardCount: inventory.cardCount,
        maxCards: inventory.maxCards,
        price,
        commit: async () => {
          const [debited] = await tx
            .update(schema.users)
            .set({ saldo: sql`${schema.users.saldo} - ${price}`, atualizadoEm: new Date() })
            .where(and(eq(schema.users.id, user.id), gte(schema.users.saldo, price)))
            .returning({ balance: schema.users.saldo });
          if (!debited) throw new Error('Insufficient balance.');
          const [userCard] = await tx
            .insert(schema.userCards)
            .values({ userId: user.id, cardId, claimedBy: 'hire' })
            .returning({ id: schema.userCards.id });
          if (!userCard) throw new Error('Failed to add card.');
          await tx
            .insert(schema.transactionHistory)
            .values({ userId: user.id, type: 'purchase', amount: -price });
          return { userCardId: userCard.id, balance: debited.balance, price };
        },
      });
    });
  }

  async runSale<T>(
    identity: DiscordIdentity,
    userCardIds: readonly string[],
    operation: (transaction: SaleCardsTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await this.loadDatabase();
    const { and, db, eq, inArray, sql, schema } = database;
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`card-market:${identity.id}`}))`,
      );
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      const cards = await tx
        .select({
          userCardId: schema.userCards.id,
          holder: schema.userCards.holder,
          favorite: schema.userCards.favorite,
          captain: schema.userCards.captain,
          overall: schema.cards.overall,
        })
        .from(schema.userCards)
        .innerJoin(schema.cards, eq(schema.userCards.cardId, schema.cards.id))
        .where(
          and(eq(schema.userCards.userId, user.id), inArray(schema.userCards.id, [...userCardIds])),
        );
      const marketConfig = await this.marketConfig(tx, schema);
      const prices = await tx.query.cardPriceConfigs.findMany({
        columns: { overall: true, price: true },
        where: inArray(schema.cardPriceConfigs.overall, [
          ...new Set(cards.map((card) => card.overall)),
        ]),
      });
      const priceByOverall = new Map(prices.map((price) => [price.overall, price.price]));
      const pricedCards = cards.map((card) => {
        const basePrice = priceByOverall.get(card.overall);
        if (basePrice === undefined) throw new Error('Card price is unavailable.');
        return {
          userCardId: card.userCardId,
          holder: card.holder,
          favorite: card.favorite,
          captain: card.captain,
          price: marketPrice(basePrice, marketConfig.sellMultiplierBasisPoints),
        };
      });
      return operation({
        balance: user.balance,
        cards: pricedCards,
        commit: async (amount) => {
          const [credited] = await tx
            .update(schema.users)
            .set({ saldo: sql`${schema.users.saldo} + ${amount}`, atualizadoEm: new Date() })
            .where(eq(schema.users.id, user.id))
            .returning({ balance: schema.users.saldo });
          if (!credited) throw new Error('Failed to credit user.');
          const deleted = await tx
            .delete(schema.userCards)
            .where(
              and(
                eq(schema.userCards.userId, user.id),
                inArray(schema.userCards.id, [...userCardIds]),
              ),
            )
            .returning({ id: schema.userCards.id });
          if (deleted.length !== userCardIds.length) throw new Error('Failed to remove cards.');
          await tx
            .insert(schema.transactionHistory)
            .values({ userId: user.id, type: 'sale', amount });
          await advanceMissions(
            database,
            tx,
            user.id,
            'sell_player',
            new Date(),
            userCardIds.length,
          );
          return { userCardIds: deleted.map((card) => card.id), balance: credited.balance, amount };
        },
      });
    });
  }

  private async marketConfig(
    tx: Parameters<Parameters<Database['db']['transaction']>[0]>[0],
    schema: Database['schema'],
  ): Promise<{ buyMultiplierBasisPoints: number; sellMultiplierBasisPoints: number }> {
    await tx.insert(schema.cardMarketConfig).values({ singleton: true }).onConflictDoNothing();
    const config = await tx.query.cardMarketConfig.findFirst({
      columns: { buyMultiplierBasisPoints: true, sellMultiplierBasisPoints: true },
    });
    if (!config) throw new Error('Card market configuration is unavailable.');
    return config;
  }
}
