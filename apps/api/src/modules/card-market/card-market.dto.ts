import type { tags } from 'typia';

export interface CardMarketIdentity {
  id: string & tags.MinLength<1> & tags.MaxLength<80>;
  name: string & tags.MinLength<1> & tags.MaxLength<80>;
  avatarUrl: (string & tags.Format<'url'> & tags.MaxLength<2048>) | null;
}

export interface PurchaseCardRequest {
  identity: CardMarketIdentity;
}

export interface PurchaseCardResponse {
  userCardId: string;
  balance: number;
  price: number;
}

export interface SellCardsRequest {
  identity: CardMarketIdentity;
  userCardIds: (string & tags.Format<'uuid'>)[] & tags.MinItems<1>;
}

export interface SellCardsResponse {
  userCardIds: string[];
  balance: number;
  amount: number;
}
