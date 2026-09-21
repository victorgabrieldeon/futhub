import { configureApiClient } from '@futhub/api-client';

export type ApiRequest = Readonly<{
  method: string;
  path: string;
  body: unknown;
}>;

export type MockApi = Readonly<{
  requests: readonly ApiRequest[];
  urls: readonly string[];
}>;

export function mockApi(
  responseBody: unknown | ((request: ApiRequest) => unknown),
  status = 200,
): MockApi {
  const requests: ApiRequest[] = [];
  const urls: string[] = [];

  configureApiClient({
    baseUrl: 'https://api.test',
    token: 'test-token',
    fetch: async (input, init) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(input.toString());
      const request = {
        method: init?.method ?? 'GET',
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      };
      requests.push(request);
      urls.push(`${url.pathname}${url.search}`);
      return Response.json(
        typeof responseBody === 'function' ? responseBody(request) : responseBody,
        { status },
      );
    },
  });

  return { requests, urls };
}
