import assert from 'node:assert/strict';
import test from 'node:test';

import { configureApiClient, executeLucro, listCardMarket, request } from './index.js';

test('executeLucro sends authenticated request to configured API', async () => {
  let requestUrl: string | undefined;
  let requestInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    requestUrl = input.toString();
    requestInit = init;
    return new Response(
      JSON.stringify({
        kind: 'cooldown',
        availableAt: '2026-08-15T12:10:00.000Z',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  configureApiClient({
    baseUrl: 'https://api.example.com',
    token: 'internal-token',
    fetch: fakeFetch,
  });

  const result = await executeLucro({ id: '1', name: 'Nome', avatarUrl: null });

  assert.equal(requestUrl, 'https://api.example.com/v1/commands/lucro');
  assert.equal(new Headers(requestInit?.headers).get('authorization'), 'Bearer internal-token');
  assert.deepEqual(result, {
    kind: 'cooldown',
    availableAt: '2026-08-15T12:10:00.000Z',
  });
});

test('listCardMarket serializes repeated position filters', async () => {
  let requestUrl: URL | undefined;
  configureApiClient({
    baseUrl: 'https://api.example.com',
    token: 'internal-token',
    fetch: async (input) => {
      requestUrl = new URL(input.toString());
      return Response.json({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
    },
  });

  await listCardMarket({
    page: 1,
    positions: ['MA', 'CA'],
    minOverall: 60,
    maxOverall: 100,
    sort: 'recent',
  });

  assert.deepEqual(requestUrl?.searchParams.getAll('positions'), ['MA', 'CA']);
});

test('request preserves API validation details', async () => {
  configureApiClient({
    baseUrl: 'https://api.example.com',
    token: 'internal-token',
    fetch: async () =>
      new Response(
        JSON.stringify({
          errors: [{ path: '$input.slug' }],
          message: 'Request body data is not following the promised type.',
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
  });

  await assert.rejects(() => request('/v1/admin/cards', { method: 'POST' }), {
    message:
      'FutHub API request failed with status 400: Request body data is not following the promised type. ($input.slug)',
  });
});

test('request accepts an empty successful response', async () => {
  configureApiClient({
    baseUrl: 'https://api.example.com',
    token: 'internal-token',
    fetch: async () => new Response(null, { status: 204 }),
  });

  assert.equal(await request('/v1/team/tactic', { method: 'PUT' }), undefined);
});

test('request keeps configuration after module reload', async () => {
  configureApiClient({
    baseUrl: 'https://api.example.com',
    token: 'internal-token',
    fetch: async () => Response.json({ ok: true }),
  });

  const reloaded = await import(`./request.js?reload=${Date.now()}`);

  assert.deepEqual(await reloaded.request('/v1/health', { method: 'GET' }), { ok: true });
});
