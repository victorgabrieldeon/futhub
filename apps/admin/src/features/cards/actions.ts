import {
  ApiClientError,
  type GetV1AdminCardsCollectionsParams,
  type GetV1AdminCardsParams,
  type GetV1AdminCardsTeamsParams,
  deleteV1AdminCardsCardId,
  deleteV1AdminCardsCollectionsCollectionId,
  deleteV1AdminCardsTeamsTeamId,
  getPostV1AdminCardsImportUrl,
  getPostV1AdminCardsPreviewUrl,
  getPutV1AdminCardsCardIdImageUrl,
  getV1AdminCards,
  getV1AdminCardsCatalog,
  getV1AdminCardsCollectionArtworkSuggestions,
  getV1AdminCardsCollections,
  getV1AdminCardsTeamLogoDetails,
  getV1AdminCardsTeamLogoSuggestions,
  getV1AdminCardsTeams,
  getV1AdminCardsTemplate,
  postV1AdminCards,
  postV1AdminCardsCollections,
  postV1AdminCardsTeams,
  putV1AdminCardsCardId,
  putV1AdminCardsCollectionsCollectionId,
  putV1AdminCardsTeamsTeamId,
  request,
} from '@futhub/api-client';
import { adminApiOptions } from '../../api/admin-client';

export type Reference = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  imageUrl: string | null;
};
export type Catalog = {
  collections: Reference[];
  teams: Reference[];
};
export type Card = {
  id: string;
  slug: string;
  name: string;
  collection: Reference;
  team: Reference;
  position: string;
  secondaryPositions: string[];
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
};
export type CardMutationResult =
  | Readonly<{ ok: true; card: Card }>
  | Readonly<{ ok: false; error: string }>;
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type CardFilters = Omit<GetV1AdminCardsParams, 'page' | 'pageSize'>;
export type CollectionFilters = Omit<GetV1AdminCardsCollectionsParams, 'page' | 'pageSize'>;
export type TeamFilters = Omit<GetV1AdminCardsTeamsParams, 'page' | 'pageSize'>;
export type Preview = {
  valid: boolean;
  createCount: number;
  updateCount: number;
  errors: { row: number; field: string; message: string }[];
};
export type Team = {
  slug: string;
  id: string;
  name: string;
  emoji: string;
  color: string;
  colors: string[];
  imageUrl: string | null;
};

export type TeamLogoSuggestion = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sourceUrl: string;
};
export type TeamLogoDetails = {
  name: string;
  slug: string;
  symbol: string;
  colors: string[];
  imageUrl: string;
  sourceUrl: string;
};
export type CollectionArtworkSuggestion = {
  name: string;
  slug: string;
  symbol: string;
  primaryColor: string;
  secondaryColor: string;
  imageUrl: string;
  overlayUrl: string;
  bannerUrl: string;
  description: string;
  sourceUrl: string;
};
export type Collection = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  primaryColor: string;
  secondaryColor: string;
  imageUrl: string | null;
  overlayUrl: string | null;
  bannerUrl: string | null;
  contractsBlocked: boolean;
};
export type TeamInput = Omit<Team, 'id'>;
export type CollectionInput = Omit<Collection, 'id'>;

function adminMultipartRequest<T>(path: string, init: RequestInit): Promise<T> {
  adminApiOptions();
  return request<T>(path, init);
}

export async function getCatalog(): Promise<Catalog> {
  return getV1AdminCardsCatalog(adminApiOptions()) as Promise<Catalog>;
}

export async function listCards(
  page: number,
  pageSize: number,
  filters: CardFilters = {},
): Promise<Page<Card>> {
  return getV1AdminCards({ page, pageSize, ...filters }, adminApiOptions()) as Promise<Page<Card>>;
}

export async function listTeamCards(
  teamId: string,
  page: number,
  pageSize: number,
): Promise<Page<Card>> {
  return getV1AdminCards({ page, pageSize, teamId }, adminApiOptions()) as Promise<Page<Card>>;
}

export async function listCollections(
  page: number,
  pageSize: number,
  filters: CollectionFilters = {},
): Promise<Page<Collection>> {
  return getV1AdminCardsCollections({ page, pageSize, ...filters }, adminApiOptions()) as Promise<
    Page<Collection>
  >;
}

export async function listTeams(
  page: number,
  pageSize: number,
  filters: TeamFilters = {},
): Promise<Page<Team>> {
  return getV1AdminCardsTeams({ page, pageSize, ...filters }, adminApiOptions()) as Promise<
    Page<Team>
  >;
}
export async function searchCollectionArtworkSuggestions(
  query = '',
  signal?: AbortSignal,
): Promise<CollectionArtworkSuggestion[]> {
  return getV1AdminCardsCollectionArtworkSuggestions(
    { q: query },
    { ...adminApiOptions(), signal },
  ) as Promise<CollectionArtworkSuggestion[]>;
}

export async function searchTeamLogoSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<TeamLogoSuggestion[]> {
  return getV1AdminCardsTeamLogoSuggestions(
    { q: query },
    { ...adminApiOptions(), signal },
  ) as Promise<TeamLogoSuggestion[]>;
}

export async function getTeamLogoDetails(
  slug: string,
  signal?: AbortSignal,
): Promise<TeamLogoDetails> {
  return getV1AdminCardsTeamLogoDetails(
    { slug },
    { ...adminApiOptions(), signal },
  ) as Promise<TeamLogoDetails>;
}

export async function createCollection(input: CollectionInput): Promise<Collection> {
  return postV1AdminCardsCollections(input, adminApiOptions()) as Promise<Collection>;
}

export async function updateCollection(id: string, input: CollectionInput): Promise<Collection> {
  return putV1AdminCardsCollectionsCollectionId(
    id,
    input,
    adminApiOptions(),
  ) as Promise<Collection>;
}

export async function removeCollection(id: string): Promise<void> {
  await deleteV1AdminCardsCollectionsCollectionId(id, adminApiOptions());
}

export async function createTeam(input: TeamInput): Promise<Team> {
  return postV1AdminCardsTeams(input, adminApiOptions()) as Promise<Team>;
}

export async function updateTeam(id: string, input: TeamInput): Promise<Team> {
  return putV1AdminCardsTeamsTeamId(id, input, adminApiOptions()) as Promise<Team>;
}

export async function removeTeam(id: string): Promise<void> {
  await deleteV1AdminCardsTeamsTeamId(id, adminApiOptions());
}

async function cardMutation(action: () => Promise<Card>): Promise<CardMutationResult> {
  try {
    return { ok: true, card: await action() };
  } catch (error) {
    if (error instanceof ApiClientError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function createCard(input: Record<string, unknown>): Promise<CardMutationResult> {
  return cardMutation(
    async () => postV1AdminCards(input as never, adminApiOptions()) as Promise<Card>,
  );
}

export async function updateCard(
  id: string,
  input: Record<string, unknown>,
): Promise<CardMutationResult> {
  return cardMutation(
    async () => putV1AdminCardsCardId(id, input as never, adminApiOptions()) as Promise<Card>,
  );
}

export async function removeCard(id: string): Promise<void> {
  await deleteV1AdminCardsCardId(id, adminApiOptions());
}

export async function uploadCardImage(id: string, form: FormData): Promise<Card> {
  return adminMultipartRequest(getPutV1AdminCardsCardIdImageUrl(id), { method: 'PUT', body: form });
}

export async function previewCards(form: FormData, signal?: AbortSignal): Promise<Preview> {
  return adminMultipartRequest(getPostV1AdminCardsPreviewUrl(), {
    method: 'POST',
    body: form,
    signal,
  });
}

export async function importCards(form: FormData): Promise<Preview> {
  return adminMultipartRequest(getPostV1AdminCardsImportUrl(), { method: 'POST', body: form });
}

export async function downloadCardsTemplate(): Promise<{
  filename: string;
  contentBase64: string;
}> {
  const template = await getV1AdminCardsTemplate(adminApiOptions());
  return { filename: template.filename, contentBase64: template.content };
}
