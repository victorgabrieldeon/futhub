import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';

import type { TeamLogoDetails, TeamLogoSuggestion } from './admin-cards.dto.js';

const footyLogosIndexUrl = 'https://www.footylogos.com/data/search-index.json';
const footyLogosAssetPrefix = 'https://assets.footylogos.com/';
const footyLogosOrigin = 'https://www.footylogos.com';
const indexCacheDuration = 60 * 60 * 1_000;
const suggestionLimit = 8;

type FootyLogosEntry = Readonly<{
  name: string;
  slug: string;
  meta: string;
  imageUrl: string;
  sourceUrl: string;
  terms: string;
}>;

@Injectable()
export class FootyLogosService {
  private cachedIndex: Promise<readonly FootyLogosEntry[]> | null = null;
  private cacheExpiresAt = 0;

  async search(query: string): Promise<TeamLogoSuggestion[]> {
    const normalizedQuery = normalize(query);
    if (normalizedQuery.length < 2) return [];

    return (await this.index())
      .map((entry) => ({ entry, score: score(entry, normalizedQuery) }))
      .filter((result) => result.score >= 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.entry.name.localeCompare(right.entry.name),
      )
      .slice(0, suggestionLimit)
      .map(({ entry }) => ({
        name: entry.name,
        slug: entry.slug,
        description: entry.meta,
        imageUrl: entry.imageUrl,
        sourceUrl: entry.sourceUrl,
      }));
  }

  async details(slug: string): Promise<TeamLogoDetails> {
    const sourceUrl = new URL(`/logos/${slug}`, footyLogosOrigin);
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new BadGatewayException(`FootyLogos returned ${response.status}.`);
    const html = await response.text();
    const encodedName = html.match(/<meta\s+property="og:image:alt"\s+content="([^"]+)"/i)?.[1];
    const name = encodedName
      ? decodeHtml(encodedName)
          .replace(/\s+logo$/i, '')
          .trim()
      : '';
    if (!name) throw new BadGatewayException('FootyLogos returned an invalid logo page.');
    const colors = Array.from(
      new Set(
        Array.from(html.matchAll(/data-copy-color="(#[0-9A-Fa-f]{6})"/g)).flatMap((match) => {
          const color = match[1];
          return color ? [color.toUpperCase()] : [];
        }),
      ),
    );
    const encodedSymbol = html.match(/<dt>Text on logo<\/dt>\s*<dd>([^<]*)<\/dd>/i)?.[1];
    const symbol = teamSymbol(encodedSymbol ? decodeHtml(encodedSymbol) : '', name);
    return {
      name,
      slug,
      symbol,
      colors,
      imageUrl: new URL(
        `logos/${slug}/${slug}-logo-footylogos.svg`,
        footyLogosAssetPrefix,
      ).toString(),
      sourceUrl: sourceUrl.toString(),
    };
  }

  async image(slug: string): Promise<Readonly<{ buffer: Buffer; contentType: string }>> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException('Invalid FootyLogos slug.');
    }
    const response = await fetch(
      new URL(`logos/${slug}/${slug}-logo-footylogos.svg`, footyLogosAssetPrefix),
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) throw new BadGatewayException(`FootyLogos returned ${response.status}.`);
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim();
    if (contentType !== 'image/svg+xml') {
      throw new BadGatewayException('FootyLogos returned an invalid logo asset.');
    }
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
  }

  private index(): Promise<readonly FootyLogosEntry[]> {
    if (!this.cachedIndex || Date.now() >= this.cacheExpiresAt) {
      this.cachedIndex = this.loadIndex().then(
        (entries) => {
          this.cacheExpiresAt = Date.now() + indexCacheDuration;
          return entries;
        },
        (error: unknown) => {
          this.cachedIndex = null;
          throw error;
        },
      );
    }
    return this.cachedIndex;
  }

  private async loadIndex(): Promise<readonly FootyLogosEntry[]> {
    const response = await fetch(footyLogosIndexUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`FootyLogos returned ${response.status}.`);
    const source: unknown = await response.json();
    if (!Array.isArray(source)) throw new Error('FootyLogos returned an invalid search index.');
    return source.flatMap(entry);
  }
}

function entry(value: unknown): FootyLogosEntry[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('kind' in value) ||
    !('label' in value) ||
    !('meta' in value) ||
    !('preview' in value) ||
    !('href' in value) ||
    !('terms' in value) ||
    (value.kind !== 'logo' && value.kind !== 'national-team') ||
    typeof value.label !== 'string' ||
    typeof value.meta !== 'string' ||
    typeof value.preview !== 'string' ||
    typeof value.href !== 'string' ||
    typeof value.terms !== 'string' ||
    !value.preview.startsWith(footyLogosAssetPrefix) ||
    !value.href.startsWith('/logos/')
  ) {
    return [];
  }
  const slug = value.href.slice('/logos/'.length).replace(/\/$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return [];
  return [
    {
      name: value.label,
      slug,
      meta: value.meta,
      imageUrl: new URL(
        `logos/${slug}/${slug}-logo-footylogos.svg`,
        footyLogosAssetPrefix,
      ).toString(),
      sourceUrl: new URL(value.href, footyLogosOrigin).toString(),
      terms: value.terms,
    },
  ];
}

function score(entry: FootyLogosEntry, query: string): number {
  const name = normalize(entry.name);
  if (name === query) return 1_000;
  if (name.startsWith(query)) return 700;
  if (name.includes(query)) return 400;
  return normalize(`${entry.name} ${entry.terms}`).includes(query) ? 100 : -1;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;|&#38;|&#x26;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function initials(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('pt-BR');
}

function teamSymbol(value: string, name: string): string {
  const symbol = value.trim();
  return symbol && symbol.length <= 30 ? symbol : initials(name);
}
