import type { tags } from 'typia';

export interface ProgressionRewardDto {
  itemId: string & tags.Format<'uuid'>;
  type: 'card' | 'pack' | 'balance' | 'field';
  quantity: number & tags.Minimum<1>;
  resourceId: (string & tags.Format<'uuid'>) | null;
}

export interface ProgressionDto {
  gainedXp: number & tags.Minimum<0>;
  level: number & tags.Minimum<1>;
  xp: number & tags.Minimum<0>;
  nextLevelXp: number & tags.Minimum<1>;
  rewards: readonly ProgressionRewardDto[];
}
