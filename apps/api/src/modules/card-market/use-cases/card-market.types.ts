import type {
  CardMarketCatalog,
  CardMarketItem,
  CardMarketListQuery,
  CardMarketPage,
  CardMarketPosition,
} from '../card-market.dto.js';

export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;
export type ListCardsQuery = Readonly<
  Omit<CardMarketListQuery, 'positions'> & {
    positions?: readonly CardMarketPosition[];
  }
>;
export type ListCardsResult = CardMarketPage;
export type ListCardsItem = CardMarketItem;
export type ListCatalogResult = CardMarketCatalog;

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
  captain: boolean;
  price: number;
}>;

export type SaleCardsTransaction = Readonly<{
  balance: number;
  cards: readonly SaleCard[];
  commit(amount: number): Promise<SaleCardsResult>;
}>;

export abstract class CardMarketRepository {
  abstract listCards(query: ListCardsQuery): Promise<ListCardsResult>;

  abstract listCatalog(): Promise<ListCatalogResult>;

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
