import type { tags } from 'typia';

import type { ProgressionDto } from '../progression/progression.dto.js';

export interface PackShopItemDto {
  id: string & tags.Format<'uuid'>;
  name: string;
  price: number;
  imageUrl: string;
  cardsPerPack: number;
}

export interface PackShopDto {
  packs: PackShopItemDto[];
  page: number;
  totalPages: number;
}

export interface PackShopQueryDto {
  page?: number & tags.Type<'int32'> & tags.Minimum<1>;
}

export interface PackActionRequest {
  identity: {
    id: string & tags.MinLength<1> & tags.MaxLength<80>;
    name: string & tags.MinLength<1> & tags.MaxLength<80>;
    avatarUrl: (string & tags.Format<'url'> & tags.MaxLength<2048>) | null;
  };
}

export interface PurchasePackResponse {
  balance: number;
  quantity: number;
}
export interface OpenPackResponse {
  cards: { id: string; card: { id: string; overall: number } }[];
  progression: ProgressionDto;
}
