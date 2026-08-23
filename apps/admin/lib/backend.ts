import 'server-only';

import type { LucroCommandContract, LucroConfig, LucroConfigInput } from './lucro';

const apiUrl = process.env.ADMIN_API_URL ?? 'http://localhost:3000';

export class BackendError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${apiKey}`);
  if (init.body) headers.set('content-type', 'application/json');

  let response: Response;
  try {
    response = await fetch(new URL(path, apiUrl), { ...init, cache: 'no-store', headers });
  } catch {
    throw new BackendError(502, 'Não foi possível conectar à API.');
  }
  if (!response.ok) {
    if (response.status === 401) throw new BackendError(401, 'API key inválida.');
    throw new BackendError(response.status, 'Não foi possível concluir operação.');
  }
  return (await response.json()) as T;
}

export function getLucroConfig(apiKey: string): Promise<LucroConfig> {
  return request(apiKey, '/v1/admin/lucro');
}

export function getLucroCommandContract(apiKey: string): Promise<LucroCommandContract> {
  return request(apiKey, '/v1/commands/lucro/schema');
}

export function updateLucroConfig(apiKey: string, config: LucroConfigInput): Promise<LucroConfig> {
  return request(apiKey, '/v1/admin/lucro', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}
