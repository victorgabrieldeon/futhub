import { refreshApiClient } from '../../shared/command.js';
import { storeResponse } from './response.js';
import type { StoreSession, StoreSessionState } from './session.js';
import {
  initialPacksState,
  isCardPosition,
  isStoreTab,
  loadHiringState,
  storeSessionManager,
  toggleFavoritePack,
  withHiringFilter,
  withHiringSelection,
  withStorePage,
  withStoreTab,
} from './state.js';

type StoreEvent = Readonly<{
  action: 'tab' | 'page' | 'favorite' | 'position-menu' | 'sort-menu' | 'card-menu';
  value: string;
}>;

export async function openStorePanel(ownerId: string) {
  const session = storeSessionManager.create(ownerId, initialPacksState());
  return storeResponse(session, 'packs');
}

export async function updateStorePanel(session: StoreSession, event: StoreEvent) {
  refreshApiClient();
  const { state } = session;
  if (state.tab === 'contratar' && state.purchase.kind === 'purchasing')
    throw new Error('Store purchase is in progress.');

  if (event.action === 'card-menu') {
    if (state.tab !== 'contratar') throw new Error('Card selection outside hiring tab.');
    const next = withHiringSelection(state, event.value);
    if (next.selection.kind !== 'selected' || next.selection.cardId !== event.value)
      throw new Error('Selected store card is unavailable.');
    return replace(session, next);
  }

  let next: StoreSessionState;
  if (event.action === 'tab') {
    if (!isStoreTab(event.value)) throw new Error('Invalid store tab.');
    next = withStoreTab(state, event.value);
    if (next.tab === 'contratar') {
      next = await loadHiringState(next);
    }
  } else if (event.action === 'page') {
    const page = Number(event.value);
    if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid store page.');
    if (state.tab === 'contratar') {
      next = await loadHiringState(state, { page });
    } else next = withStorePage(state, page);
  } else if (event.action === 'favorite') {
    next = toggleFavoritePack(state, event.value);
  } else {
    if (state.tab !== 'contratar') throw new Error('Store filter outside hiring tab.');
    let filters: typeof state.filters;
    if (event.action === 'position-menu') {
      if (event.value !== 'all' && !isCardPosition(event.value))
        throw new Error('Invalid card position.');
      filters = withHiringFilter(state, { position: event.value === 'all' ? null : event.value });
    } else {
      if (!isCardSort(event.value)) throw new Error('Invalid card sort.');
      filters = withHiringFilter(state, { sort: event.value });
    }
    next = await loadHiringState(state, { page: 1, filters });
  }
  return replace(session, next);
}

function replace(session: StoreSession, state: StoreSessionState) {
  return storeSessionManager.replaceStateIf(session.id, session.ownerId, session.state, state);
}

function isCardSort(value: string): value is 'recent' | 'overall' | 'name' {
  return ['recent', 'overall', 'name'].includes(value);
}
