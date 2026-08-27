import type { tags } from 'typia';

export type CardPosition = 'GOL' | 'LD' | 'LE' | 'ZAG' | 'VOL' | 'MA' | 'MC' | 'PD' | 'PE' | 'CA';
export type Slug = string & tags.Pattern<'^[a-z0-9]+(?:-[a-z0-9]+)*$'> & tags.MaxLength<100>;
export type HexColor = string & tags.Pattern<'^#[0-9A-Fa-f]{6}$'>;

export interface CardInput {
  slug: Slug;
  name: string & tags.MinLength<1> & tags.MaxLength<100>;
  collectionId: string & tags.Format<'uuid'>;
  teamId: string & tags.Format<'uuid'>;
  position: CardPosition;
  secondaryPositions?: CardPosition[];
  contractsBlocked?: boolean;
  defense: number & tags.Minimum<1>;
  attack: number & tags.Minimum<1>;
  creation: number & tags.Minimum<1>;
  overall: number & tags.Minimum<60> & tags.Maximum<100>;
  passing: number & tags.Minimum<1>;
  control: number & tags.Minimum<1>;
  marking: number & tags.Minimum<1>;
  pace: number & tags.Minimum<1>;
  dribbling: number & tags.Minimum<1>;
  finishing: number & tags.Minimum<1>;
}

export type CardUpdate = Omit<CardInput, 'slug'>;

export interface CardListQuery {
  query?: string;
  collectionId?: string;
  teamId?: string;
  position?: CardPosition;
  image?: 'default' | 'custom';
  contractsBlocked?: boolean;
  sort?: 'recent' | 'overall' | 'name';
  page: number & tags.Minimum<1>;
  pageSize?: number & tags.Minimum<1> & tags.Maximum<100>;
}

export interface CardTemplate {
  filename: string;
  content: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportPreview {
  valid: boolean;
  createCount: number;
  updateCount: number;
  errors: ImportError[];
}

export interface CardReference {
  id: string & tags.Format<'uuid'>;
  name: string;
  slug: Slug;
  emoji: string;
  imageUrl: string | null;
}

export interface CardCatalog {
  collections: CardReference[];
  teams: CardReference[];
}

export interface AdminCard {
  id: string & tags.Format<'uuid'>;
  slug: Slug;
  name: string;
  collection: CardReference;
  team: CardReference;
  position: CardPosition;
  secondaryPositions: CardPosition[];
  contractsBlocked: boolean;
  defense: number;
  attack: number;
  creation: number;
  overall: number;
  passing: number;
  control: number;
  marking: number;
  pace: number;
  dribbling: number;
  finishing: number;
  imageUrl: string;
}

export interface CardPage {
  items: AdminCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CatalogListQuery {
  query?: string & tags.MaxLength<100>;
  page: number & tags.Minimum<1>;
  pageSize?: number & tags.Minimum<1> & tags.Maximum<100>;
}
export interface CollectionListQuery extends CatalogListQuery {
  contractsBlocked?: boolean;
}

export interface TeamListQuery extends CatalogListQuery {
  image?: 'default' | 'custom';
}

export interface TeamLogoSuggestionsQuery {
  q: string & tags.MinLength<2> & tags.MaxLength<100>;
}

export interface TeamLogoSuggestion {
  name: string;
  slug: Slug;
  description: string;
  imageUrl: string;
  sourceUrl: string;
}
export interface TeamLogoDetailsQuery {
  slug: Slug;
}

export interface TeamLogoDetails {
  name: string;
  slug: Slug;
  symbol: string;
  colors: string[];
  imageUrl: string;
  sourceUrl: string;
}
export interface CollectionArtworkSuggestionsQuery {
  q: string & tags.MaxLength<100>;
}

export interface CollectionArtworkSuggestion {
  name: string;
  slug: Slug;
  symbol: string;
  primaryColor: HexColor;
  secondaryColor: HexColor;
  imageUrl: string;
  overlayUrl: string;
  bannerUrl: string;
  description: string;
  sourceUrl: string;
}

export interface PlayerPhotoSuggestionsQuery {
  q: string & tags.MinLength<2> & tags.MaxLength<100>;
}

export interface PlayerPhotoSuggestion {
  id: string;
  name: string;
  team: string;
  position: string;
  imageUrl: string;
  sourceUrl: string;
  provider: string;
}

export interface TeamInput {
  slug: Slug;
  name: string & tags.MinLength<1> & tags.MaxLength<100>;
  emoji: string & tags.MinLength<1> & tags.MaxLength<30>;
  color: HexColor;
  colors?: HexColor[] & tags.MinItems<1> & tags.MaxItems<8>;
  imageUrl?: (string & tags.MaxLength<2048>) | null;
}

export interface AdminTeam extends TeamInput {
  id: string & tags.Format<'uuid'>;
}

export interface TeamPage {
  items: AdminTeam[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CollectionInput {
  slug: Slug;
  name: string & tags.MinLength<1> & tags.MaxLength<100>;
  emoji: string & tags.MinLength<1> & tags.MaxLength<30>;
  primaryColor: string & tags.MinLength<1> & tags.MaxLength<16>;
  secondaryColor: string & tags.MinLength<1> & tags.MaxLength<16>;
  imageUrl?: (string & tags.MaxLength<2048>) | null;
  overlayUrl?: (string & tags.MaxLength<2048>) | null;
  bannerUrl?: (string & tags.MaxLength<2048>) | null;
  contractsBlocked?: boolean;
}

export interface AdminCollection extends CollectionInput {
  id: string & tags.Format<'uuid'>;
}

export interface CollectionPage {
  items: AdminCollection[];
  total: number;
  page: number;
  pageSize: number;
}
