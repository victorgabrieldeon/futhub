export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;
export type PackCard = Readonly<{ id: string; overall: number }>;
export type UserCard = Readonly<{ id: string; card: PackCard }>;
export type PurchaseResult = Readonly<{ balance: number; quantity: number }>;

export type PurchaseTransaction = Readonly<{
  canBuy: boolean;
  balance: number;
  ownedQuantity: number;
  limitPerUser: number;
  cardCount: number;
  maxCards: number;
  price: number;
  commit(): Promise<PurchaseResult>;
}>;
export type OpenTransaction = Readonly<{
  ownedQuantity: number;
  cardCount: number;
  maxCards: number;
  cardsAmount: number;
  candidates: readonly PackCard[];
  probabilities: readonly { overall: number; weight: number }[];
  commit(cards: readonly PackCard[]): Promise<readonly UserCard[]>;
}>;

export abstract class PackRepository {
  abstract runPurchase<T>(
    identity: DiscordIdentity,
    packId: string,
    operation: (transaction: PurchaseTransaction) => Promise<T>,
  ): Promise<T>;
  abstract runOpen<T>(
    identity: DiscordIdentity,
    packId: string,
    operation: (transaction: OpenTransaction) => Promise<T>,
  ): Promise<T>;
}
