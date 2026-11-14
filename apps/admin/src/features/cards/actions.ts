import {
  ApiClientError,
  type ListAdminCardsParams,
  type ListAdminCollectionsParams,
  type ListAdminTeamsParams,
  createAdminCard,
  createAdminCollection,
  createAdminTeam,
  deleteAdminCard,
  deleteAdminCollection,
  deleteAdminTeam,
  downloadCardImportTemplate,
  getAdminCardCatalog,
  getImportCardsUrl,
  getPreviewCardImportUrl,
  getSquadImportSquad,
  getUploadAdminCardImageUrl,
  listAdminCards,
  listAdminCollections,
  listAdminTeams,
  listCollectionArtworkSuggestions,
  listSquadImportClubs,
  listSquadImportLeagueClubs,
  listSquadImportLeagues,
  listTeamLogoSuggestions,
  request,
  importSquad as requestSquadImport,
  getTeamLogoDetails as requestTeamLogoDetails,
  updateAdminCard,
  updateAdminCollection,
  updateAdminTeam,
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
export type CardFilters = Omit<ListAdminCardsParams, 'page' | 'pageSize'>;
export type CollectionFilters = Omit<ListAdminCollectionsParams, 'page' | 'pageSize'>;
export type TeamFilters = Omit<ListAdminTeamsParams, 'page' | 'pageSize'>;
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
export type SquadImportClub = { id: number; name: string; league: string; imageUrl: string };
export type SquadImportLeague = { id: number; name: string; imageUrl: string; clubCount: number };
export type SquadImportPlayer = {
  sourceId: string;
  name: string;
  position: string;
  secondaryPositions: string[];
  overall: number;
  defense: number;
  attack: number;
  creation: number;
  passing: number;
  control: number;
  marking: number;
  pace: number;
  dribbling: number;
  finishing: number;
  photoUrl: string | null;
};
export type SquadImportPreview = {
  provider: 'EA SPORTS FC' | 'TheSportsDB';
  estimated: boolean;
  sourceUrl: string;
  team: TeamInput;
  crestUrl: string | null;
  existingTeam: Reference | null;
  players: SquadImportPlayer[];
};
export type SquadImportResult = {
  teamId: string;
  createCount: number;
  updateCount: number;
  photoCount: number;
  photoErrors: number;
};
export type CollectionInput = Omit<Collection, 'id'>;

function adminMultipartRequest<T>(path: string, init: RequestInit): Promise<T> {
  adminApiOptions();
  return request<T>(path, init);
}

export async function getCatalog(): Promise<Catalog> {
  return getAdminCardCatalog(adminApiOptions()) as Promise<Catalog>;
}

export async function listCards(
  page: number,
  pageSize: number,
  filters: CardFilters = {},
): Promise<Page<Card>> {
  return listAdminCards({ page, pageSize, ...filters }, adminApiOptions()) as Promise<Page<Card>>;
}

export async function listTeamCards(
  teamId: string,
  page: number,
  pageSize: number,
): Promise<Page<Card>> {
  return listAdminCards({ page, pageSize, teamId }, adminApiOptions()) as Promise<Page<Card>>;
}

export async function listCollections(
  page: number,
  pageSize: number,
  filters: CollectionFilters = {},
): Promise<Page<Collection>> {
  return listAdminCollections({ page, pageSize, ...filters }, adminApiOptions()) as Promise<
    Page<Collection>
  >;
}

export async function listTeams(
  page: number,
  pageSize: number,
  filters: TeamFilters = {},
): Promise<Page<Team>> {
  return listAdminTeams({ page, pageSize, ...filters }, adminApiOptions()) as Promise<Page<Team>>;
}
export async function searchCollectionArtworkSuggestions(
  query = '',
  signal?: AbortSignal,
): Promise<CollectionArtworkSuggestion[]> {
  return listCollectionArtworkSuggestions(
    { q: query },
    { ...adminApiOptions(), signal },
  ) as Promise<CollectionArtworkSuggestion[]>;
}

export async function searchTeamLogoSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<TeamLogoSuggestion[]> {
  return listTeamLogoSuggestions({ q: query }, { ...adminApiOptions(), signal }) as Promise<
    TeamLogoSuggestion[]
  >;
}

export async function getTeamLogoDetails(
  slug: string,
  signal?: AbortSignal,
): Promise<TeamLogoDetails> {
  return requestTeamLogoDetails(
    { slug },
    { ...adminApiOptions(), signal },
  ) as Promise<TeamLogoDetails>;
}

export async function createCollection(input: CollectionInput): Promise<Collection> {
  return createAdminCollection(input, adminApiOptions()) as Promise<Collection>;
}

export async function updateCollection(id: string, input: CollectionInput): Promise<Collection> {
  return updateAdminCollection(id, input, adminApiOptions()) as Promise<Collection>;
}

export async function removeCollection(id: string): Promise<void> {
  await deleteAdminCollection(id, adminApiOptions());
}

export async function createTeam(input: TeamInput): Promise<Team> {
  return createAdminTeam(input, adminApiOptions()) as Promise<Team>;
}

export async function updateTeam(id: string, input: TeamInput): Promise<Team> {
  return updateAdminTeam(id, input, adminApiOptions()) as Promise<Team>;
}

export async function removeTeam(id: string): Promise<void> {
  await deleteAdminTeam(id, adminApiOptions());
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
    async () => createAdminCard(input as never, adminApiOptions()) as Promise<Card>,
  );
}

export async function updateCard(
  id: string,
  input: Record<string, unknown>,
): Promise<CardMutationResult> {
  return cardMutation(
    async () => updateAdminCard(id, input as never, adminApiOptions()) as Promise<Card>,
  );
}

export async function removeCard(id: string): Promise<void> {
  await deleteAdminCard(id, adminApiOptions());
}

export async function uploadCardImage(id: string, form: FormData): Promise<Card> {
  return adminMultipartRequest(getUploadAdminCardImageUrl(id), { method: 'PUT', body: form });
}

export async function previewCards(form: FormData, signal?: AbortSignal): Promise<Preview> {
  return adminMultipartRequest(getPreviewCardImportUrl(), {
    method: 'POST',
    body: form,
    signal,
  });
}

export async function importCards(form: FormData): Promise<Preview> {
  return adminMultipartRequest(getImportCardsUrl(), { method: 'POST', body: form });
}

export async function downloadCardsTemplate(): Promise<{
  filename: string;
  contentBase64: string;
}> {
  const template = await downloadCardImportTemplate(adminApiOptions());
  return { filename: template.filename, contentBase64: template.content };
}

export async function searchSquadImportClubs(
  query: string,
  signal?: AbortSignal,
): Promise<SquadImportClub[]> {
  return listSquadImportClubs({ q: query }, { ...adminApiOptions(), signal });
}

export async function loadSquadImportLeagues(): Promise<SquadImportLeague[]> {
  return listSquadImportLeagues(adminApiOptions());
}

export async function loadSquadImportLeagueClubs(
  leagueId: number,
  signal?: AbortSignal,
): Promise<SquadImportClub[]> {
  return listSquadImportLeagueClubs({ leagueId }, { ...adminApiOptions(), signal });
}

export async function loadSquadImportPreview(
  source: Readonly<{ clubId: number } | { name: string }>,
): Promise<SquadImportPreview> {
  return getSquadImportSquad(source, adminApiOptions()) as Promise<SquadImportPreview>;
}

export async function importSquad(
  input: Readonly<{
    collectionId: string;
    teamId: string | null;
    team: TeamInput;
    players: Omit<SquadImportPlayer, 'sourceId'>[];
    crestUrl: string | null;
    replaceImages?: boolean;
  }>,
): Promise<SquadImportResult> {
  return requestSquadImport(input as Parameters<typeof requestSquadImport>[0], adminApiOptions());
}
