import { BadGatewayException, Injectable } from '@nestjs/common';

import type { CollectionArtworkSuggestion } from './admin-cards.dto.js';

const game = '26';
const futGgOrigin = 'https://www.fut.gg';
const futGgDataOrigin = 'https://r2.fut.gg';
const futGgAssetOrigin = 'https://game-assets.fut.gg';
const cacheDuration = 60 * 60 * 1_000;
const suggestionLimit = 8;

type FutGgRarity = Readonly<{
  name: string;
  slug: string;
  dominantColor: string;
  textColor: unknown[];
  imageUrl: string;
  compactImageUrl: string;
  rarityGroupName: string | null;
}>;

@Injectable()
export class FutGgRaritiesService {
  private cachedRarities: Promise<readonly CollectionArtworkSuggestion[]> | null = null;
  private cacheExpiresAt = 0;

  async search(query: string): Promise<CollectionArtworkSuggestion[]> {
    const normalizedQuery = normalize(query);
    if (normalizedQuery.length < 2) {
      return (await this.rarities()).slice(0, suggestionLimit);
    }

    return (await this.rarities())
      .map((rarity) => ({ rarity, score: score(rarity, normalizedQuery) }))
      .filter((result) => result.score >= 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.rarity.name.localeCompare(right.rarity.name),
      )
      .slice(0, suggestionLimit)
      .map(({ rarity }) => rarity);
  }

  private rarities(): Promise<readonly CollectionArtworkSuggestion[]> {
    if (!this.cachedRarities || Date.now() >= this.cacheExpiresAt) {
      this.cachedRarities = this.loadRarities().then(
        (rarities) => {
          this.cacheExpiresAt = Date.now() + cacheDuration;
          return rarities;
        },
        (error: unknown) => {
          this.cachedRarities = null;
          throw error;
        },
      );
    }
    return this.cachedRarities;
  }

  private async loadRarities(): Promise<CollectionArtworkSuggestion[]> {
    const manifestResponse = await fetch(new URL(`/${game}/manifest.json`, futGgDataOrigin), {
      signal: AbortSignal.timeout(5_000),
    });
    if (!manifestResponse.ok) {
      throw new BadGatewayException(`FUT.GG returned ${manifestResponse.status}.`);
    }
    const manifest: unknown = await manifestResponse.json();
    const version = coreDataVersion(manifest);
    if (!version) throw new BadGatewayException('FUT.GG returned an invalid manifest.');

    const dataResponse = await fetch(
      new URL(`/${game}/fc-core-data.v1.${version}.json`, futGgDataOrigin),
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!dataResponse.ok) throw new BadGatewayException(`FUT.GG returned ${dataResponse.status}.`);
    const data: unknown = await dataResponse.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('rarities' in data) ||
      !Array.isArray(data.rarities)
    ) {
      throw new BadGatewayException('FUT.GG returned invalid rarity data.');
    }

    const suggestions = new Map<string, CollectionArtworkSuggestion>();
    for (const value of data.rarities) {
      const suggestion = rarity(value);
      if (suggestion) suggestions.set(suggestion.slug, suggestion);
    }
    return [...suggestions.values()];
  }
}

function coreDataVersion(value: unknown): string | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('fc-core-data' in value) ||
    typeof value['fc-core-data'] !== 'string' ||
    !/^[a-f0-9]{8,64}$/.test(value['fc-core-data'])
  ) {
    return null;
  }
  return value['fc-core-data'];
}

function rarity(value: unknown): CollectionArtworkSuggestion | null {
  if (!isFutGgRarity(value) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) return null;
  const primaryColor = /^[0-9A-Fa-f]{6}$/.test(value.dominantColor)
    ? `#${value.dominantColor.toUpperCase()}`
    : null;
  const rawSecondaryColor = value.textColor.find(
    (color) => typeof color === 'string' && /^[0-9A-Fa-f]{6}$/.test(color),
  );
  const secondaryColor =
    typeof rawSecondaryColor === 'string' ? `#${rawSecondaryColor.toUpperCase()}` : null;
  const imageUrl = assetUrl(value.compactImageUrl);
  const artworkUrl = assetUrl(value.imageUrl);
  if (!primaryColor || !secondaryColor || !imageUrl || !artworkUrl) return null;

  return {
    name: value.name,
    slug: value.slug,
    symbol: initials(value.name),
    primaryColor,
    secondaryColor,
    imageUrl,
    overlayUrl: artworkUrl,
    bannerUrl: artworkUrl,
    description: `${value.rarityGroupName ?? 'Card design'} · FC ${game}`,
    sourceUrl: new URL(`/rarities/${value.slug}/`, futGgOrigin).toString(),
  };
}

function isFutGgRarity(value: unknown): value is FutGgRarity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'slug' in value &&
    'dominantColor' in value &&
    'textColor' in value &&
    'imageUrl' in value &&
    'compactImageUrl' in value &&
    'rarityGroupName' in value &&
    typeof value.name === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.dominantColor === 'string' &&
    Array.isArray(value.textColor) &&
    typeof value.imageUrl === 'string' &&
    typeof value.compactImageUrl === 'string' &&
    (value.rarityGroupName === null || typeof value.rarityGroupName === 'string')
  );
}

function assetUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin === futGgAssetOrigin && url.pathname.endsWith('.png') ? url.toString() : null;
  } catch {
    return null;
  }
}

function score(rarity: CollectionArtworkSuggestion, query: string): number {
  const name = normalize(rarity.name);
  if (name === query) return 1_000;
  if (name.startsWith(query)) return 700;
  if (name.includes(query)) return 400;
  return normalize(`${rarity.name} ${rarity.description}`).includes(query) ? 100 : -1;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function initials(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .split(/\s+/)
    .filter((word) => word && !['da', 'de', 'do', 'of', 'the'].includes(word.toLowerCase()))
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('pt-BR');
}
