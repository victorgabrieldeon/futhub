import { BadGatewayException, BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AiHttpClient, normalizeAiBaseUrl } from './ai-http-client.js';

type SearchSource = {
  readonly title: string;
  readonly url: string;
  readonly description: string;
};
function sourceUrl(value: string): string | undefined {
  if (value.length > 2048 || !/^https?:\/\//i.test(value) || /[\s\\\p{Cc}]/u.test(value))
    return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password) return undefined;
    // Reuse transport's public-host rules; source links are never fetched here.
    normalizeAiBaseUrl(`https://${url.host}/`);
    return url.href.length <= 2048 ? url.href : undefined;
  } catch (error) {
    if (error instanceof BadRequestException || error instanceof TypeError) return undefined;
    throw error;
  }
}

function snippet(value: string, limit: number): string {
  return Array.from(
    value
      .replace(/<[^<>]*>/g, '')
      .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
      .trim(),
  )
    .slice(0, limit)
    .join('');
}

function attribute(value: string, name: string): string | undefined {
  return value.match(new RegExp(`\\b${name}=(['\"])(.*?)\\1`, 'iu'))?.[2];
}

function decodeHtml(value: string): string {
  return value.replace(/&(amp|quot|#39|#x27|lt|gt);/giu, (entity) => {
    switch (entity.toLowerCase()) {
      case '&amp;':
        return '&';
      case '&quot;':
        return '"';
      case '&#39;':
      case '&#x27;':
        return "'";
      case '&lt;':
        return '<';
      case '&gt;':
        return '>';
      default:
        return entity;
    }
  });
}

@Injectable()
export class AiWebSearchService {
  constructor(@Inject(AiHttpClient) private readonly http: AiHttpClient) {}

  available(): boolean {
    return true;
  }

  async search(query: string): Promise<string> {
    const normalized = query.trim();
    if (
      !normalized ||
      normalized.length > 400 ||
      normalized.split(/\s+/u).length > 50 ||
      /\p{Cc}/u.test(normalized)
    ) {
      throw new BadRequestException(
        'Web search query must contain 1–400 characters and at most 50 words.',
      );
    }
    const target = new URL('https://search.brave.com/search');
    target.searchParams.set('q', normalized);
    const response = await this.http
      .request(target, {
        method: 'GET',
        headers: { Accept: 'text/html', 'User-Agent': 'FutHub admin assistant' },
        responseType: 'text',
      })
      .catch(() => {
        throw new BadGatewayException('Web search request failed.');
      });
    if (response.status === 429)
      throw new BadGatewayException('Web search rate or quota limit reached.');
    if (response.status !== 200) throw new BadGatewayException('Web search provider failed.');
    if (typeof response.body !== 'string')
      throw new BadGatewayException('Web search returned an invalid response.');

    const sources: SearchSource[] = [];
    const result = { query: normalized, sources, truncated: false };
    const entries = Array.from(
      response.body.matchAll(/<div\b[^>]*\bdata-type=(['"])web\1[^>]*>/giu),
    );
    for (const [index, entry] of entries.entries()) {
      if (sources.length === 5) {
        result.truncated = true;
        break;
      }
      const start = (entry.index ?? 0) + entry[0].length;
      const block = response.body.slice(start, entries[index + 1]?.index ?? response.body.length);
      const link = block.match(
        /<a\b([^>]*)>[\s\S]*?<div\b[^>]*class=(['"])[^'"]*\bsearch-snippet-title\b[^'"]*\2[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/a>/iu,
      );
      const rawTitle = link?.[3] ?? '';
      const url = sourceUrl(decodeHtml(attribute(link?.[1] ?? '', 'href') ?? ''));
      const title = snippet(decodeHtml(rawTitle), 200);
      const description = snippet(
        decodeHtml(
          block.match(
            /<div\b[^>]*class=['"][^'"]*\bgeneric-snippet\b[^'"]*['"][^>]*>[\s\S]*?<div\b[^>]*class=['"][^'"]*\bcontent\b[^'"]*['"][^>]*>([\s\S]*?)<\/div>/iu,
          )?.[1] ?? '',
        ),
        1000,
      );
      if (!url || !title) {
        result.truncated = true;
        continue;
      }
      result.truncated ||= title !== decodeHtml(rawTitle) || description.length === 1000;
      sources.push({ title, url, description });
      if (Buffer.byteLength(JSON.stringify(result)) > 16 * 1024) {
        sources.pop();
        result.truncated = true;
        break;
      }
    }
    return JSON.stringify(result);
  }
}
