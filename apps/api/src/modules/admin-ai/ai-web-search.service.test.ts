import { BadGatewayException, BadRequestException } from '@nestjs/common';
import typia from 'typia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiHttpClient } from './ai-http-client.js';
import { AiWebSearchService } from './ai-web-search.service.js';

type Output = {
  readonly query: string;
  readonly sources: readonly {
    readonly title: string;
    readonly url: string;
    readonly description: string;
  }[];
  readonly truncated: boolean;
};
const source = {
  title: 'First team squad',
  url: 'https://www.fcbarcelona.com/en/football/first-team/players',
  description: 'First-team players published by club.',
};
const client = new AiHttpClient();
const service = new AiWebSearchService(client);

function page(entries: readonly (typeof source)[] = [source]): string {
  return entries
    .map(
      (entry) =>
        `<div class="snippet" data-type="web"><div class="result-content"><a href="${entry.url}"><div class="title search-snippet-title">${entry.title}</div></a><div class="generic-snippet"><div class="content">${entry.description}</div></div></div></div>`,
    )
    .join('');
}

function response(body: unknown = page()) {
  return vi.spyOn(client, 'request').mockResolvedValue({ status: 200, body });
}

function output(value: string): Output {
  return typia.assert<Output>(JSON.parse(value));
}

afterEach(() => vi.restoreAllMocks());

describe('AI web search', () => {
  it('works without a configured API key and uses fixed Brave Search endpoint', async () => {
    // Given
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '');
    const request = response();
    const query = 'Barcelona squad 2026 &count=20';
    // When
    const result = output(await service.search(`  ${query}  `));
    // Then
    expect(service.available()).toBe(true);
    expect(result).toMatchObject({ query, sources: [source], truncated: false });
    const target = new URL('https://search.brave.com/search');
    target.searchParams.set('q', query);
    expect(request).toHaveBeenCalledExactlyOnceWith(target, {
      method: 'GET',
      headers: { Accept: 'text/html', 'User-Agent': 'FutHub admin assistant' },
      responseType: 'text',
    });
  });

  it.each(['', ' \n ', 'q'.repeat(401), Array(51).fill('q').join(' '), 'squad\u0000'])(
    'rejects invalid query %j before network',
    async (query) => {
      const request = response();
      await expect(service.search(query)).rejects.toBeInstanceOf(BadRequestException);
      expect(request).not.toHaveBeenCalled();
    },
  );

  it.each([202, 301, 400, 403, 429, 500])('sanitizes provider HTTP %i', async (status) => {
    vi.spyOn(client, 'request').mockResolvedValue({ status, body: 'secret raw-body' });
    const failure = await service.search('current squad').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BadGatewayException);
    expect(String(failure)).not.toContain('secret raw-body');
  });

  it('rejects invalid provider data', async () => {
    response({ html: page() });
    await expect(service.search('current squad')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('returns no invented source for empty result page', async () => {
    response('No results.');
    expect(output(await service.search('unknown team squad')).sources).toEqual([]);
  });

  it('drops unsafe result URLs', async () => {
    response(page([{ ...source, url: 'https://127.0.0.1/private' }, source]));
    const result = output(await service.search('current squad'));
    expect(result.sources).toEqual([source]);
    expect(result.truncated).toBe(true);
  });

  it('caps sources and text fields', async () => {
    response(
      page(
        Array.from({ length: 8 }, (_, index) => ({
          title: `<strong>${'t'.repeat(500)}</strong>`,
          url: `${source.url}/${index}`,
          description: `${'d'.repeat(2000)}\u0000`,
        })),
      ),
    );
    const serialized = await service.search('current squad');
    const result = output(serialized);
    expect(result.sources).toHaveLength(5);
    expect(result.truncated).toBe(true);
    expect(result.sources[0]).toMatchObject({
      title: 't'.repeat(200),
      description: 'd'.repeat(1000),
    });
    expect(Buffer.byteLength(serialized)).toBeLessThanOrEqual(16 * 1024);
  });
});
