export type ApiClientOptions = Readonly<{
  baseUrl: string;
  token: string;
  fetch?: typeof globalThis.fetch;
}>;

let options: Readonly<{
  baseUrl: URL;
  token: string;
  fetch: typeof globalThis.fetch;
}> | null = null;

export function configureApiClient(config: ApiClientOptions): void {
  const baseUrl = new URL(config.baseUrl);
  if (!['http:', 'https:'].includes(baseUrl.protocol))
    throw new Error('API base URL must use HTTP or HTTPS.');
  if (!config.token) throw new Error('API token is required.');
  options = { baseUrl, token: config.token, fetch: config.fetch ?? globalThis.fetch };
}

export async function request<T>(url: string, init: RequestInit): Promise<T> {
  if (!options) throw new Error('API client is not configured.');
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${options.token}`);
  const response = await options.fetch(new URL(url, options.baseUrl), { ...init, headers });
  if (!response.ok) throw new Error(`FutHub API request failed with status ${response.status}.`);
  return JSON.parse(await response.text());
}
