import { listCardMarket, listCardMarketCatalog } from '@futhub/api-client';

import { createStoreSessionManager } from './session.js';
import type { CardPosition, StoreFilters, StorePacks, StoreSessionState } from './session.js';

const storeTabs = ['packs', 'contratar'] as const;
export type StoreTab = (typeof storeTabs)[number];

export const storeSessionManager = createStoreSessionManager({ clock: () => Date.now() });

export function isStoreTab(value: string): value is StoreTab {
  return (storeTabs as readonly string[]).includes(value);
}

export function initialPacksState(): StorePacks {
  return { tab: 'packs', page: 1, favoritePackIds: [] };
}

export type HiringState = Extract<StoreSessionState, { readonly tab: 'contratar' }>;

export function initialHiringState(): HiringState {
  return {
    tab: 'contratar',
    filters: {
      positions: [],
      minOverall: 60,
      maxOverall: 100,
      teamId: null,
      collectionId: null,
      sort: 'recent',
    },
    page: 1,
    total: 0,
    totalPages: 1,
    catalog: { teams: [], collections: [] },
    items: [],
    selection: { kind: 'none' },
    pickerPage: 0,
    purchase: { kind: 'idle' },
  };
}

export function withStoreTab(state: StoreSessionState, tab: StoreTab): StoreSessionState {
  if (tab === 'packs') return state.tab === 'packs' ? state : initialPacksState();
  return state.tab === 'contratar' ? state : initialHiringState();
}

export function withStorePage(state: StoreSessionState, page: number): StoreSessionState {
  return { ...state, page };
}

export async function loadHiringState(
  state: HiringState,
  changes: Readonly<{ page?: number; filters?: StoreFilters }> = {},
): Promise<HiringState> {
  const filters = changes.filters ?? state.filters;
  const page = changes.page ?? state.page;
  const needsCatalog = state.catalog.teams.length === 0 && state.catalog.collections.length === 0;
  const [result, catalog] = await Promise.all([
    listCardMarket({
      page,
      ...(filters.positions.length > 0 ? { positions: [...filters.positions] } : {}),
      minOverall: filters.minOverall,
      maxOverall: filters.maxOverall,
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.collectionId ? { collectionId: filters.collectionId } : {}),
      sort: filters.sort,
    }),
    needsCatalog ? listCardMarketCatalog() : Promise.resolve(state.catalog),
  ]);
  return {
    ...state,
    filters,
    page: result.page,
    total: result.total,
    totalPages: Math.max(1, result.totalPages),
    catalog,
    items: result.items,
    selection: { kind: 'none' },
    purchase: { kind: 'idle' },
  };
}

export function withHiringSelection(state: HiringState, cardId: string): HiringState {
  if (state.purchase.kind === 'purchasing') return state;
  return state.items.some((card) => card.id === cardId)
    ? { ...state, selection: { kind: 'selected', cardId }, purchase: { kind: 'idle' } }
    : state;
}

export function isCardPosition(value: string): value is CardPosition {
  return ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'].includes(value);
}

export function withHiringFilter(
  state: HiringState,
  change: Readonly<{ position?: CardPosition | null; sort?: StoreFilters['sort'] }>,
): StoreFilters {
  return {
    ...state.filters,
    ...(change.position !== undefined
      ? { positions: change.position === null ? [] : [change.position] }
      : {}),
    ...(change.sort ? { sort: change.sort } : {}),
  };
}

export function toggleFavoritePack(state: StoreSessionState, packId: string): StoreSessionState {
  if (state.tab !== 'packs') return state;
  const favoritePackIds = state.favoritePackIds.includes(packId)
    ? state.favoritePackIds.filter((id) => id !== packId)
    : [...state.favoritePackIds, packId];
  return { ...state, page: 1, favoritePackIds };
}
