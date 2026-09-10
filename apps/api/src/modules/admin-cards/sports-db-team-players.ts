import {
  BadGatewayException,
  BadRequestException,
  PreconditionFailedException,
} from '@nestjs/common';

const sportsDbOrigin = 'https://www.thesportsdb.com';

type SportsDbTeam = Readonly<{ idTeam: string; strSport: string; strTeam: string }>;
type SportsDbPlayer = Readonly<{
  idPlayer: string;
  strPlayer: string;
  strPosition: string | null;
  strSport: string;
  strStatus?: string | null;
  strTeam: string | null;
}>;

export async function searchSportsDbTeamPlayers(query: string) {
  const teamName = query.trim();
  if (teamName.length < 2 || teamName.length > 100 || /\p{Cc}/u.test(teamName)) {
    throw new BadRequestException('Team name must contain 2–100 valid characters.');
  }
  const apiKey = process.env.THESPORTSDB_API_KEY?.trim();
  if (!apiKey || apiKey === '123') {
    throw new PreconditionFailedException(
      'Configure a premium THESPORTSDB_API_KEY to load the complete roster.',
    );
  }
  try {
    const teamResponse = await fetch(sportsDbUrl(apiKey, 'searchteams.php', ['t', teamName]), {
      signal: AbortSignal.timeout(5_000),
    });
    if (!teamResponse.ok) throw new Error(`TheSportsDB returned ${teamResponse.status}.`);
    const teams = sportsDbList(await teamResponse.json(), 'teams').filter(isSportsDbTeam);
    const normalized = teamName.toLocaleLowerCase('en');
    const soccerTeams = teams.filter((candidate) => candidate.strSport === 'Soccer');
    const team =
      soccerTeams.find((candidate) => candidate.strTeam.toLocaleLowerCase('en') === normalized) ??
      soccerTeams[0];
    if (!team) return { team: null, players: [], provider: 'TheSportsDB' as const };

    const playerResponse = await fetch(
      sportsDbUrl(apiKey, 'lookup_all_players.php', ['id', team.idTeam]),
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!playerResponse.ok) throw new Error(`TheSportsDB returned ${playerResponse.status}.`);
    const players = sportsDbList(await playerResponse.json(), 'player')
      .filter(isSportsDbPlayer)
      .filter(
        (player) =>
          player.strStatus !== 'Coaching' &&
          !/\b(?:coach|manager)\b/iu.test(player.strPosition ?? ''),
      )
      .map((player) => ({
        id: player.idPlayer,
        name: player.strPlayer,
        team: player.strTeam ?? team.strTeam,
        position: player.strPosition ?? '',
        sourceUrl: new URL(`/player/${player.idPlayer}`, sportsDbOrigin).toString(),
      }));
    return {
      team: {
        id: team.idTeam,
        name: team.strTeam,
        sourceUrl: new URL(`/team/${team.idTeam}`, sportsDbOrigin).toString(),
      },
      players,
      provider: 'TheSportsDB' as const,
    };
  } catch {
    throw new BadGatewayException('TheSportsDB team players are unavailable.');
  }
}

function sportsDbUrl(
  apiKey: string,
  endpoint: string,
  query: readonly [parameter: string, value: string],
): URL {
  const url = new URL(`/api/v1/json/${encodeURIComponent(apiKey)}/${endpoint}`, sportsDbOrigin);
  url.searchParams.set(...query);
  return url;
}

function sportsDbList(value: unknown, property: 'player' | 'teams'): unknown[] {
  if (typeof value !== 'object' || value === null) {
    throw new Error('TheSportsDB returned an invalid response.');
  }
  const list =
    property === 'player'
      ? 'player' in value
        ? value.player
        : undefined
      : 'teams' in value
        ? value.teams
        : undefined;
  if (list === undefined) throw new Error('TheSportsDB returned an invalid response.');
  if (list === null) return [];
  if (!Array.isArray(list)) throw new Error('TheSportsDB returned an invalid list.');
  return list;
}

function isSportsDbTeam(value: unknown): value is SportsDbTeam {
  return (
    typeof value === 'object' &&
    value !== null &&
    'idTeam' in value &&
    'strSport' in value &&
    'strTeam' in value &&
    typeof value.idTeam === 'string' &&
    typeof value.strSport === 'string' &&
    typeof value.strTeam === 'string'
  );
}

function isSportsDbPlayer(value: unknown): value is SportsDbPlayer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'idPlayer' in value &&
    'strPlayer' in value &&
    'strPosition' in value &&
    'strSport' in value &&
    'strTeam' in value &&
    typeof value.idPlayer === 'string' &&
    typeof value.strPlayer === 'string' &&
    (value.strPosition === null || typeof value.strPosition === 'string') &&
    value.strSport === 'Soccer' &&
    (!('strStatus' in value) || value.strStatus === null || typeof value.strStatus === 'string') &&
    (value.strTeam === null || typeof value.strTeam === 'string')
  );
}
