import { configureApiClient } from '@futhub/api-client';

export type ApiRequest = Readonly<{
  method: string;
  path: string;
  body: unknown;
}>;

export type MockApi = Readonly<{ requests: readonly ApiRequest[] }>;

export function mockApi(responseBody: unknown, status = 200): MockApi {
  const requests: ApiRequest[] = [];

  configureApiClient({
    baseUrl: 'https://api.test',
    token: 'test-token',
    fetch: async (input, init) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(input.toString());
      requests.push({
        method: init?.method ?? 'GET',
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      });
      return Response.json(responseBody, { status });
    },
  });

  return { requests };
}
