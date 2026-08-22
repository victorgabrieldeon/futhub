import type * as DatabaseModule from '@futhub/database';

import { advanceMissions } from '../../missions/missions.service.js';
import { cardInventoryCapacity, upsertDiscordUser } from '../../users/user.repository.js';
import { CardMarketRepository } from '../use-cases/card-market.types.js';
import type {
  DiscordIdentity,
  PurchaseCardTransaction,
  SaleCardsTransaction,
} from '../use-cases/card-market.types.js';

const basisPoints = 10_000n;
const maxBalance = 2_147_483_647n;

type Database = typeof DatabaseModule;
type DatabaseLoader = () => Promise<Database>;

function marketPrice(price: number, multiplierBasisPoints: number): number {
  const result = (BigInt(price) * BigInt(multiplierBasisPoints)) / basisPoints;
  if (result > maxBalance) throw new Error('Card market price exceeds balance limit.');
  return Number(result);
}

export class DrizzleCardMarketRepository extends CardMarketRepository {
  constructor(private readonly loadDatabase: DatabaseLoader) {
    super();
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
