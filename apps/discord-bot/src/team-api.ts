import { getLeague, getV1MatchesMatchId, joinRankedQueue, request } from '@futhub/api-client';

import { refreshApiClient } from './commands/shared.js';
import type {
  ClubResponse,
  LeaguePanelState,
  TeamPosition,
  TeamResponse,
  TeamSession,
} from './team-session.js';

type Identity = TeamSession['identity'];
export async function loadLeague(identity: Identity): Promise<LeaguePanelState> {
  refreshApiClient();
  const status = await getLeague(identity);
  const match =
    status.queue?.kind === 'matched' ? await getV1MatchesMatchId(status.queue.matchId) : null;
  return { status, match };
}

export async function queueLeagueMatch(identity: Identity): Promise<LeaguePanelState> {
  refreshApiClient();
  await joinRankedQueue(identity);
  return loadLeague(identity);
}

export async function reloadTeam(session: TeamSession, page = 1): Promise<TeamResponse> {
  return loadTeam(session.identity, {
    ...session.filters,
    page,
  });
}

export async function loadTeam(
  identity: Identity,
  view: Readonly<{
    page: number;
    name: string;
    position: TeamPosition | null;
    collectionId: string | null;
    sort: 'overall' | 'name' | 'recent';
  }>,
): Promise<TeamResponse> {
  refreshApiClient();
  return request<TeamResponse>('/v1/team', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity, ...view }),
  });
}

export function loadClub(identity: Identity): Promise<ClubResponse> {
  refreshApiClient();
  return request<ClubResponse>('/v1/club', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(identity),
  });
}

export function upgradeClubStadium(identity: Identity): Promise<ClubResponse> {
  refreshApiClient();
  return request<ClubResponse>('/v1/club/stadium/upgrade', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(identity),
  });
}

export function setFormation(identity: Identity, formationId: string): Promise<void> {
  return mutate('/v1/team/formation', 'PUT', { identity, formationId });
}

export function setTactic(identity: Identity, tactic: TeamResponse['tactic']): Promise<void> {
  return mutate('/v1/team/tactic', 'PUT', { identity, tactic });
}

export function autoLineup(identity: Identity): Promise<void> {
  return mutate('/v1/team/lineup/auto', 'POST', { identity });
}

export function setLineupCard(
  identity: Identity,
  userCardId: string,
  position: TeamPosition,
): Promise<void> {
  return mutate('/v1/team/lineup', 'PUT', { identity, userCardId, position });
}

export function setCaptain(identity: Identity, userCardId: string): Promise<void> {
  return mutate('/v1/team/captain', 'PUT', { identity, userCardId });
}

export function toggleFavorite(identity: Identity, userCardId: string): Promise<void> {
  return mutate(`/v1/team/cards/${userCardId}/favorite`, 'PUT', { identity });
}

export function sellTeamCard(
  identity: Identity,
  userCardId: string,
): Promise<{ userCardIds: string[]; balance: number; amount: number }> {
  refreshApiClient();
  return request('/v1/cards/sell', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity, userCardIds: [userCardId] }),
  });
}

function mutate(path: string, method: 'POST' | 'PUT', body: unknown): Promise<void> {
  refreshApiClient();
  return request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
