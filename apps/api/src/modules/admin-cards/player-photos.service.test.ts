import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlayerPhotosService } from './player-photos.service.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('PlayerPhotosService team players', () => {
  it('resolves a soccer team and returns only players', async () => {
    vi.stubEnv('THESPORTSDB_API_KEY', 'premium-key');
    const players = Array.from({ length: 101 }, (_, index) => ({
      idPlayer: String(index),
      strPlayer: `Player ${index}`,
      strTeam: 'Arsenal',
      strSport: 'Soccer',
      strPosition: 'Right Winger',
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            teams: [
              { idTeam: '133604', strTeam: 'Arsenal', strSport: 'Soccer' },
              { idTeam: 'other', strTeam: 'Arsenal', strSport: 'Basketball' },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            player: [
              ...players,
              {
                idPlayer: '34170000',
                strPlayer: 'Assistant',
                strTeam: 'Arsenal',
                strSport: 'Soccer',
                strPosition: 'Assistant Coach',
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new PlayerPhotosService().teamPlayers(' Arsenal ');
    expect(result.team).toEqual({
      id: '133604',
      name: 'Arsenal',
      sourceUrl: 'https://www.thesportsdb.com/team/133604',
    });
    expect(result.players).toHaveLength(101);
    expect(result.players.at(-1)?.name).toBe('Player 100');
    expect(result.provider).toBe('TheSportsDB');
    expect(fetchMock.mock.calls.map(([input]) => new URL(input).pathname)).toEqual([
      '/api/v1/json/premium-key/searchteams.php',
      '/api/v1/json/premium-key/lookup_all_players.php',
    ]);
  });

  it('rejects the free key instead of returning a partial roster', async () => {
    vi.stubEnv('THESPORTSDB_API_KEY', '123');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(new PlayerPhotosService().teamPlayers('Arsenal')).rejects.toThrow(
      'Configure a premium THESPORTSDB_API_KEY to load the complete roster.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
