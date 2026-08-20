export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;

export type PurchaseCardResult = Readonly<{
  userCardId: string;
  balance: number;
  price: number;
}>;

export type SaleCardsResult = Readonly<{
  userCardIds: readonly string[];
  balance: number;
  amount: number;
}>;

export type PurchaseCardTransaction = Readonly<{
  cardExists: boolean;
  contractsBlocked: boolean;
  balance: number;
  cardCount: number;
  maxCards: number;
  price: number;
  commit(): Promise<PurchaseCardResult>;
}>;

export type SaleCard = Readonly<{
  userCardId: string;
  holder: boolean;
  favorite: boolean;
  price: number;
}>;

export type SaleCardsTransaction = Readonly<{
  balance: number;
  cards: readonly SaleCard[];
  commit(amount: number): Promise<SaleCardsResult>;
}>;

export abstract class CardMarketRepository {
  abstract runPurchase<T>(
    identity: DiscordIdentity,
    cardId: string,
    operation: (transaction: PurchaseCardTransaction) => Promise<T>,
  ): Promise<T>;

  abstract runSale<T>(
    identity: DiscordIdentity,
    userCardIds: readonly string[],
    operation: (transaction: SaleCardsTransaction) => Promise<T>,
  ): Promise<T>;
}
