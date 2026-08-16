import assert from 'node:assert/strict';
import test from 'node:test';

import { configureApiClient, executeLucro } from './index.js';

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
