import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';

import type { PlayerPhotoSuggestion } from './admin-cards.dto.js';
import { searchSportsDbTeamPlayers } from './sports-db-team-players.js';

const sportsDbOrigin = 'https://www.thesportsdb.com';
const sportsDbImageOrigin = 'https://r2.thesportsdb.com';
const providerSearchLimit = 6;
const suggestionLimit = 16;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const jpegSignature = Buffer.from([255, 216, 255]);
const sportsDbMedia = {
  cutout: {
    directory: 'cutout',
    extension: 'png',
    contentType: 'image/png',
    signature: pngSignature,
  },
  render: {
    directory: 'render',
    extension: 'png',
    contentType: 'image/png',
    signature: pngSignature,
  },
  cartoon: {
    directory: 'cartoon',
    extension: 'png',
    contentType: 'image/png',
    signature: pngSignature,
  },
  thumb: {
    directory: 'thumb',
    extension: 'jpg',
    contentType: 'image/jpeg',
    signature: jpegSignature,
  },
  poster: {
    directory: 'poster',
    extension: 'jpg',
    contentType: 'image/jpeg',
    signature: jpegSignature,
  },
} as const;

type SportsDbMediaKind = keyof typeof sportsDbMedia;
type SportsDbPlayer = Readonly<{
  idPlayer: string;
  strCutout: string;
  strPlayer: string;
  strPosition: string | null;
  strSport: string;
  strTeam: string | null;
}>;
type SportsDbPlayerDetails = SportsDbPlayer &
  Partial<
    Readonly<{
      strCartoon: string | null;
      strPoster: string | null;
      strRender: string | null;
      strThumb: string | null;
    }>
  >;

@Injectable()
export class PlayerPhotosService {
  async teamPlayers(query: string) {
    return searchSportsDbTeamPlayers(query);
  }

  async search(query: string): Promise<PlayerPhotoSuggestion[]> {
    const name = query.trim();
    if (name.length < 2) return [];

    try {
      return (await this.searchSportsDb(name)).slice(0, suggestionLimit);
    } catch {
      throw new BadGatewayException('TheSportsDB player photos are unavailable.');
    }
  }

  private async searchSportsDb(name: string): Promise<PlayerPhotoSuggestion[]> {
    const apiKey = process.env.THESPORTSDB_API_KEY?.trim() || '123';
    const url = new URL(
      `/api/v1/json/${encodeURIComponent(apiKey)}/searchplayers.php`,
      sportsDbOrigin,
    );
    url.searchParams.set('p', name);

    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`TheSportsDB returned ${response.status}.`);
    const source: unknown = await response.json();
    if (typeof source !== 'object' || source === null || !('player' in source)) {
      throw new Error('TheSportsDB returned an invalid player search response.');
    }
    if (source.player === null) return [];
    if (!Array.isArray(source.player)) {
      throw new Error('TheSportsDB returned an invalid player list.');
    }

    const players = source.player
      .filter(isSportsDbPlayer)
      .filter((candidate) => playerPhotos(candidate).length > 0)
      .slice(0, providerSearchLimit);
    const details = await Promise.allSettled(
      players.map((candidate) => this.lookupSportsDbPlayer(candidate.idPlayer)),
    );
    const photos = players.flatMap((candidate, index) => {
      const detail = details[index];
      return detail?.status === 'fulfilled' && detail.value
        ? playerPhotos(detail.value)
        : playerPhotos(candidate);
    });
    photos.sort(
      (first, second) =>
        Number(first.imageUrl.endsWith('.jpg')) - Number(second.imageUrl.endsWith('.jpg')),
    );
    return photos;
  }

  private async lookupSportsDbPlayer(id: string): Promise<SportsDbPlayerDetails | null> {
    const apiKey = process.env.THESPORTSDB_API_KEY?.trim() || '123';
    const url = new URL(
      `/api/v1/json/${encodeURIComponent(apiKey)}/lookupplayer.php`,
      sportsDbOrigin,
    );
    url.searchParams.set('id', id);

    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`TheSportsDB returned ${response.status}.`);
    const source: unknown = await response.json();
    if (typeof source !== 'object' || source === null || !('players' in source)) {
      throw new Error('TheSportsDB returned an invalid player details response.');
    }
    if (source.players === null) return null;
    if (!Array.isArray(source.players)) {
      throw new Error('TheSportsDB returned an invalid player details list.');
    }
    return source.players.find(isSportsDbPlayer) ?? null;
  }

  async image(
    kind: string,
    filename: string,
  ): Promise<Readonly<{ buffer: Buffer; contentType: string }>> {
    const media = sportsDbMedia[kind as SportsDbMediaKind];
    if (
      !media ||
      !/^[a-zA-Z0-9_-]+\.(?:png|jpg)$/.test(filename) ||
      !filename.endsWith(`.${media.extension}`)
    ) {
      throw new BadRequestException('Invalid player photo filename.');
    }
    const url = new URL(`/images/media/player/${media.directory}/${filename}`, sportsDbImageOrigin);
    const response = await fetch(url, {
      headers: { accept: media.contentType },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new BadGatewayException(`TheSportsDB returned ${response.status}.`);
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (
      contentType !== media.contentType ||
      buffer.length < media.signature.length ||
      !buffer.subarray(0, media.signature.length).equals(media.signature)
    ) {
      throw new BadGatewayException('TheSportsDB returned an invalid player image.');
    }
    return { buffer, contentType };
  }
}

function playerPhotos(value: SportsDbPlayerDetails): PlayerPhotoSuggestion[] {
  const media = [
    ['cutout', value.strCutout],
    ['render', value.strRender],
    ['poster', value.strPoster],
    ['thumb', value.strThumb],
    ['cartoon', value.strCartoon],
  ] as const;
  const suggestions: PlayerPhotoSuggestion[] = [];
  for (const [kind, source] of media) {
    suggestions.push(...sportsDbPlayerPhoto(value, kind, source));
  }
  return suggestions;
}

function sportsDbPlayerPhoto(
  player: SportsDbPlayer,
  kind: SportsDbMediaKind,
  source: string | null | undefined,
): PlayerPhotoSuggestion[] {
  if (!source) return [];

  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return [];
  }
  const media = sportsDbMedia[kind];
  if (
    imageUrl.origin !== sportsDbImageOrigin ||
    !imageUrl.pathname.toLowerCase().endsWith(`.${media.extension}`)
  ) {
    return [];
  }

  const filename = imageUrl.pathname.split('/').pop();
  if (!filename) return [];
  const imagePath =
    kind === 'cutout'
      ? `/v1/admin/cards/player-photos/${filename}`
      : `/v1/admin/cards/player-photos/${kind}/${filename}`;
  return [
    {
      id: `${player.idPlayer}-${kind}`,
      name: player.strPlayer,
      team: player.strTeam ?? '',
      position: player.strPosition ?? '',
      imageUrl: imagePath,
      sourceUrl: new URL(`/player/${player.idPlayer}`, sportsDbOrigin).toString(),
      provider: 'TheSportsDB',
    },
  ];
}

function isSportsDbPlayer(value: unknown): value is SportsDbPlayer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'idPlayer' in value &&
    'strCutout' in value &&
    'strPlayer' in value &&
    'strPosition' in value &&
    'strSport' in value &&
    'strTeam' in value &&
    typeof value.idPlayer === 'string' &&
    typeof value.strCutout === 'string' &&
    typeof value.strPlayer === 'string' &&
    (value.strPosition === null || typeof value.strPosition === 'string') &&
    value.strSport === 'Soccer' &&
    (value.strTeam === null || typeof value.strTeam === 'string')
  );
}
