import type { tags } from 'typia';

export type PackPosition = 'GOL' | 'LD' | 'LE' | 'ZAG' | 'VOL' | 'MA' | 'MC' | 'PD' | 'PE' | 'CA';

export interface AdminPackConfigInput {
  name: (string & tags.MaxLength<100>) | null;
  minOverall: number & tags.Type<'int32'> & tags.Minimum<60> & tags.Maximum<100>;
  maxOverall: number & tags.Type<'int32'> & tags.Minimum<60> & tags.Maximum<100>;
  onlyPositions: PackPosition[];
  excludedPositions: PackPosition[];
  onlyCollectionIds: (string & tags.Format<'uuid'>)[];
  excludedCollectionIds: (string & tags.Format<'uuid'>)[];
  onlyCardIds: (string & tags.Format<'uuid'>)[];
  excludedCardIds: (string & tags.Format<'uuid'>)[];
  onlyTeamIds: (string & tags.Format<'uuid'>)[];
  excludedTeamIds: (string & tags.Format<'uuid'>)[];
}

export interface AdminPackInput {
  name: string & tags.MinLength<1> & tags.MaxLength<100>;
  imageUrl: (string & tags.Format<'uri'> & tags.MaxLength<2048>) | null;
  color: string & tags.MinLength<1> & tags.MaxLength<16>;
  emoji: string & tags.MinLength<1> & tags.MaxLength<255>;
  cardsAmount: number & tags.Type<'int32'> & tags.Minimum<1>;
  price: number & tags.Type<'int32'> & tags.Minimum<0>;
  canBuy: boolean;
  limitPerUser: number & tags.Type<'int32'> & tags.Minimum<0>;
  config: AdminPackConfigInput;
}

export interface AdminPackConfig extends AdminPackConfigInput {
  id: string;
}
export interface AdminPack extends Omit<AdminPackInput, 'config'> {
  id: string;
  config: AdminPackConfig;
}
