import type {
  CardMarketRepository,
  DiscordIdentity,
  ListCardsQuery,
  ListCardsResult,
  ListCatalogResult,
  PurchaseCardResult,
  SaleCardsResult,
} from './card-market.types.js';

const maxBalance = 2_147_483_647;

export class ListCardsUseCase {
  constructor(private readonly repository: CardMarketRepository) {}

  execute(query: ListCardsQuery): Promise<ListCardsResult> {
    return this.repository.listCards(query);
  }
}

export class ListCardCatalogUseCase {
  constructor(private readonly repository: CardMarketRepository) {}

  execute(): Promise<ListCatalogResult> {
    return this.repository.listCatalog();
  }
}

export class PurchaseCardUseCase {
  constructor(private readonly repository: CardMarketRepository) {}

  async execute(identity: DiscordIdentity, cardId: string): Promise<PurchaseCardResult> {
    if (!cardId) throw new Error('Card id is required.');
    return this.repository.runPurchase(identity, cardId, async (transaction) => {
      if (!transaction.cardExists) throw new Error('Card not found.');
      if (transaction.contractsBlocked) throw new Error('Card is not available for purchase.');
      if (transaction.cardCount >= transaction.maxCards)
        throw new Error('Card inventory capacity exceeded.');
      if (transaction.balance < transaction.price) throw new Error('Insufficient balance.');
      return transaction.commit();
    });
  }
}

export class SellCardsUseCase {
  constructor(private readonly repository: CardMarketRepository) {}

  async execute(
    identity: DiscordIdentity,
    userCardIds: readonly string[],
  ): Promise<SaleCardsResult> {
    if (userCardIds.length === 0) throw new Error('At least one card is required.');
    if (new Set(userCardIds).size !== userCardIds.length)
      throw new Error('Card ids must be unique.');
    return this.repository.runSale(identity, userCardIds, async (transaction) => {
      if (transaction.cards.length !== userCardIds.length)
        throw new Error('One or more cards not found.');
      if (transaction.cards.some((card) => card.holder || card.favorite || card.captain))
        throw new Error('Holder, favorite, and captain cards cannot be sold.');
      const amount = transaction.cards.reduce((total, card) => total + card.price, 0);
      if (amount > maxBalance - transaction.balance) throw new Error('Balance limit exceeded.');
      return transaction.commit(amount);
    });
  }
}
