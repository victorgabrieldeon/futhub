import type { tags } from 'typia';

export type PackPosition = 'GOL' | 'LD' | 'LE' | 'ZAG' | 'VOL' | 'MA' | 'MC' | 'PD' | 'PE' | 'CA';
export type PackEffect = 'foil' | 'holographic' | 'chrome';
export type PackTexture = 'none' | 'aura' | 'fire' | 'lightning';
type HexColor = string & tags.Pattern<'^#[0-9A-Fa-f]{6}$'>;

export interface AdminPackPresentationInput {
  schemaVersion: number & tags.Type<'int32'> & tags.Minimum<1> & tags.Maximum<1>;
  color: HexColor;
  accentColor: HexColor;
  textColor: HexColor;
  effect: PackEffect;
  texture: PackTexture;
  textureOpacity: number & tags.Type<'int32'> & tags.Minimum<0> & tags.Maximum<65>;
  tintOpacity: number & tags.Type<'int32'> & tags.Minimum<0> & tags.Maximum<42>;
  headline: string & tags.MinLength<1> & tags.MaxLength<18>;
  headlineSize: number & tags.Type<'int32'> & tags.Minimum<24> & tags.Maximum<100>;
  headlineX: number & tags.Type<'int32'> & tags.Minimum<80> & tags.Maximum<520>;
  headlineY: number & tags.Type<'int32'> & tags.Minimum<190> & tags.Maximum<470>;
  kicker: string & tags.MaxLength<60>;
  kickerX: number & tags.Type<'int32'> & tags.Minimum<80> & tags.Maximum<520>;
  kickerY: number & tags.Type<'int32'> & tags.Minimum<120> & tags.Maximum<300>;
}

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
  presentation?: AdminPackPresentationInput;
}

export interface AdminPackConfig extends AdminPackConfigInput {
  id: string;
}
export interface AdminPack extends Omit<AdminPackInput, 'config' | 'presentation'> {
  id: string;
  config: AdminPackConfig;
  presentation: AdminPackPresentationInput | null;
}
