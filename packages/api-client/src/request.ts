export type ApiClientOptions = Readonly<{
  baseUrl: string;
  token: string;
  fetch?: typeof globalThis.fetch;
}>;

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

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
  if (!headers.has('authorization')) headers.set('authorization', `Bearer ${options.token}`);
  const response = await options.fetch(new URL(url, options.baseUrl), { ...init, headers });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : '';
    const firstError =
      typeof body === 'object' &&
      body !== null &&
      'errors' in body &&
      Array.isArray(body.errors) &&
      body.errors.length
        ? body.errors[0]
        : null;
    const path =
      typeof firstError === 'object' &&
      firstError !== null &&
      'path' in firstError &&
      typeof firstError.path === 'string'
        ? firstError.path
        : '';
    const detail = [message, path ? `(${path})` : ''].filter(Boolean).join(' ');
    const prefix = `FutHub API request failed with status ${response.status}`;
    throw new ApiClientError(response.status, detail ? `${prefix}: ${detail}` : `${prefix}.`);
  }
  return JSON.parse(await response.text());
}
