import type { tags } from 'typia';

import type { ProgressionDto } from '../progression/progression.dto.js';

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
