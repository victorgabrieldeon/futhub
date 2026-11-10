import { configureApiClient } from '@futhub/api-client';

const browserFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.delete('authorization');
  headers.set('x-admin-request', '1');
  return fetch(input, { ...init, credentials: 'same-origin', headers });
};

export function adminApiOptions(): { headers: Record<string, string> } {
  configureApiClient({
    baseUrl: window.location.origin,
    token: 'session-cookie',
    fetch: browserFetch,
  });
  return { headers: {} };
}
