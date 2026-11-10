import { z } from 'zod';

export const CardPositionSchema = z.enum([
  'GOL',
  'LD',
  'LE',
  'ZAG',
  'VOL',
  'MA',
  'MC',
  'PD',
  'PE',
  'CA',
]);
export type CardPosition = z.infer<typeof CardPositionSchema>;

export const SlugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type Slug = z.infer<typeof SlugSchema>;

export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export type HexColor = z.infer<typeof HexColorSchema>;

const queryBooleanSchema = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const CardInputSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(100),
  collectionId: z.uuid(),
  teamId: z.uuid(),
  position: CardPositionSchema,
  secondaryPositions: z.array(CardPositionSchema).optional(),
  contractsBlocked: z.boolean().optional(),
  defense: z.number().min(1),
  attack: z.number().min(1),
  creation: z.number().min(1),
  overall: z.number().min(60).max(100),
  passing: z.number().min(1),
  control: z.number().min(1),
  marking: z.number().min(1),
  pace: z.number().min(1),
  dribbling: z.number().min(1),
  finishing: z.number().min(1),
});
export type CardInput = z.infer<typeof CardInputSchema>;

export const CardUpdateSchema = CardInputSchema.omit({ slug: true });
export type CardUpdate = z.infer<typeof CardUpdateSchema>;

export const CardListQuerySchema = z.object({
  query: z.string().optional(),
  collectionId: z.string().optional(),
  teamId: z.string().optional(),
  position: CardPositionSchema.optional(),
  image: z.enum(['default', 'custom']).optional(),
  contractsBlocked: queryBooleanSchema.optional(),
  sort: z.enum(['recent', 'overall', 'name']).optional(),
  page: z.coerce.number().min(1),
  pageSize: z.coerce.number().min(1).max(100).optional(),
});
export type CardListQuery = z.infer<typeof CardListQuerySchema>;

export const CardTemplateSchema = z.object({ filename: z.string(), content: z.string() });
export type CardTemplate = z.infer<typeof CardTemplateSchema>;

export const ImportErrorSchema = z.object({
  row: z.number(),
  field: z.string(),
  message: z.string(),
});
export type ImportError = z.infer<typeof ImportErrorSchema>;

export const ImportPreviewSchema = z.object({
  valid: z.boolean(),
  createCount: z.number(),
  updateCount: z.number(),
  errors: z.array(ImportErrorSchema),
});
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;

export const CardReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: SlugSchema,
  emoji: z.string(),
  imageUrl: z.string().nullable(),
});
export type CardReference = z.infer<typeof CardReferenceSchema>;

export const CardCatalogSchema = z.object({
  collections: z.array(CardReferenceSchema),
  teams: z.array(CardReferenceSchema),
});
export type CardCatalog = z.infer<typeof CardCatalogSchema>;

export const AdminCardSchema = z.object({
  id: z.uuid(),
  slug: SlugSchema,
  name: z.string(),
  collection: CardReferenceSchema,
  team: CardReferenceSchema,
  position: CardPositionSchema,
  secondaryPositions: z.array(CardPositionSchema),
  contractsBlocked: z.boolean(),
  defense: z.number(),
  attack: z.number(),
  creation: z.number(),
  overall: z.number(),
  passing: z.number(),
  control: z.number(),
  marking: z.number(),
  pace: z.number(),
  dribbling: z.number(),
  finishing: z.number(),
  imageUrl: z.string(),
});
export type AdminCard = z.infer<typeof AdminCardSchema>;

export const CardPageSchema = z.object({
  items: z.array(AdminCardSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type CardPage = z.infer<typeof CardPageSchema>;

export const CatalogListQuerySchema = z.object({
  query: z.string().max(100).optional(),
  page: z.coerce.number().min(1),
  pageSize: z.coerce.number().min(1).max(100).optional(),
});
export type CatalogListQuery = z.infer<typeof CatalogListQuerySchema>;

export const CollectionListQuerySchema = CatalogListQuerySchema.extend({
  contractsBlocked: queryBooleanSchema.optional(),
});
export type CollectionListQuery = z.infer<typeof CollectionListQuerySchema>;

export const TeamListQuerySchema = CatalogListQuerySchema.extend({
  image: z.enum(['default', 'custom']).optional(),
});
export type TeamListQuery = z.infer<typeof TeamListQuerySchema>;

export const TeamLogoSuggestionsQuerySchema = z.object({ q: z.string().min(2).max(100) });
export type TeamLogoSuggestionsQuery = z.infer<typeof TeamLogoSuggestionsQuerySchema>;

export const TeamLogoSuggestionSchema = z.object({
  name: z.string(),
  slug: SlugSchema,
  description: z.string(),
  imageUrl: z.string(),
  sourceUrl: z.string(),
});
export type TeamLogoSuggestion = z.infer<typeof TeamLogoSuggestionSchema>;

export const TeamLogoDetailsQuerySchema = z.object({ slug: SlugSchema });
export type TeamLogoDetailsQuery = z.infer<typeof TeamLogoDetailsQuerySchema>;

export const TeamLogoDetailsSchema = z.object({
  name: z.string(),
  slug: SlugSchema,
  symbol: z.string(),
  colors: z.array(z.string()),
  imageUrl: z.string(),
  sourceUrl: z.string(),
});
export type TeamLogoDetails = z.infer<typeof TeamLogoDetailsSchema>;

export const CollectionArtworkSuggestionsQuerySchema = z.object({ q: z.string().max(100) });
export type CollectionArtworkSuggestionsQuery = z.infer<
  typeof CollectionArtworkSuggestionsQuerySchema
>;

export const CollectionArtworkSuggestionSchema = z.object({
  name: z.string(),
  slug: SlugSchema,
  symbol: z.string(),
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  imageUrl: z.string(),
  overlayUrl: z.string(),
  bannerUrl: z.string(),
  description: z.string(),
  sourceUrl: z.string(),
});
export type CollectionArtworkSuggestion = z.infer<typeof CollectionArtworkSuggestionSchema>;

export const PlayerPhotoSuggestionsQuerySchema = z.object({ q: z.string().min(2).max(100) });
export type PlayerPhotoSuggestionsQuery = z.infer<typeof PlayerPhotoSuggestionsQuerySchema>;

export const PlayerPhotoSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.string(),
  position: z.string(),
  imageUrl: z.string(),
  sourceUrl: z.string(),
  provider: z.string(),
});
export type PlayerPhotoSuggestion = z.infer<typeof PlayerPhotoSuggestionSchema>;

export const TeamInputSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(100),
  emoji: z.string().min(1).max(30),
  color: HexColorSchema,
  colors: z.array(HexColorSchema).min(1).max(8).optional(),
  imageUrl: z.string().max(2048).nullable().optional(),
});
export type TeamInput = z.infer<typeof TeamInputSchema>;

export const AdminTeamSchema = TeamInputSchema.extend({ id: z.uuid() });
export type AdminTeam = z.infer<typeof AdminTeamSchema>;

export const TeamPageSchema = z.object({
  items: z.array(AdminTeamSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type TeamPage = z.infer<typeof TeamPageSchema>;

export const CollectionInputSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(100),
  emoji: z.string().min(1).max(30),
  primaryColor: z.string().min(1).max(16),
  secondaryColor: z.string().min(1).max(16),
  imageUrl: z.string().max(2048).nullable().optional(),
  overlayUrl: z.string().max(2048).nullable().optional(),
  bannerUrl: z.string().max(2048).nullable().optional(),
  contractsBlocked: z.boolean().optional(),
});
export type CollectionInput = z.infer<typeof CollectionInputSchema>;

export const AdminCollectionSchema = CollectionInputSchema.extend({ id: z.uuid() });
export type AdminCollection = z.infer<typeof AdminCollectionSchema>;

export const CollectionPageSchema = z.object({
  items: z.array(AdminCollectionSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type CollectionPage = z.infer<typeof CollectionPageSchema>;

export const SquadImportClubsQuerySchema = z.object({ q: z.string().min(2).max(100) });
export type SquadImportClubsQuery = z.infer<typeof SquadImportClubsQuerySchema>;

export const SquadImportClubSchema = z.object({
  id: z.number(),
  name: z.string(),
  league: z.string(),
  imageUrl: z.string(),
});
export type SquadImportClub = z.infer<typeof SquadImportClubSchema>;

export const SquadImportLeagueSchema = z.object({
  id: z.number(),
  name: z.string(),
  imageUrl: z.string(),
  clubCount: z.number(),
});
export type SquadImportLeague = z.infer<typeof SquadImportLeagueSchema>;

export const SquadImportLeagueClubsQuerySchema = z.object({
  leagueId: z.coerce.number().int().positive(),
});
export type SquadImportLeagueClubsQuery = z.infer<typeof SquadImportLeagueClubsQuerySchema>;

export const SquadImportSquadQuerySchema = z.object({
  clubId: z.coerce.number().int().positive().optional(),
  name: z.string().min(2).max(100).optional(),
});
export type SquadImportSquadQuery = z.infer<typeof SquadImportSquadQuerySchema>;

export const SquadImportPlayerSchema = CardInputSchema.pick({
  name: true,
  position: true,
  secondaryPositions: true,
  overall: true,
  defense: true,
  attack: true,
  creation: true,
  passing: true,
  control: true,
  marking: true,
  pace: true,
  dribbling: true,
  finishing: true,
}).extend({ photoUrl: z.string().max(2048).nullable() });
export type SquadImportPlayer = z.infer<typeof SquadImportPlayerSchema>;

export const SquadImportPreviewPlayerSchema = SquadImportPlayerSchema.extend({
  sourceId: z.string(),
  overall: z.number(),
});
export type SquadImportPreviewPlayer = z.infer<typeof SquadImportPreviewPlayerSchema>;

export const SquadImportPreviewSchema = z.object({
  provider: z.enum(['EA SPORTS FC', 'TheSportsDB']),
  estimated: z.boolean(),
  sourceUrl: z.string(),
  team: TeamInputSchema.extend({ imageUrl: z.string().nullable() }),
  crestUrl: z.string().nullable(),
  existingTeam: CardReferenceSchema.nullable(),
  players: z.array(SquadImportPreviewPlayerSchema),
});
export type SquadImportPreview = z.infer<typeof SquadImportPreviewSchema>;

export const SquadImportInputSchema = z.object({
  collectionId: z.uuid(),
  teamId: z.uuid().nullable(),
  team: TeamInputSchema,
  players: z.array(SquadImportPlayerSchema).min(1).max(80),
  crestUrl: z.string().max(2048).nullable().optional(),
  replaceImages: z.boolean().optional(),
});
export type SquadImportInput = z.infer<typeof SquadImportInputSchema>;

export const SquadImportResultSchema = z.object({
  teamId: z.uuid(),
  createCount: z.number(),
  updateCount: z.number(),
  photoCount: z.number(),
  photoErrors: z.number(),
});
export type SquadImportResult = z.infer<typeof SquadImportResultSchema>;
