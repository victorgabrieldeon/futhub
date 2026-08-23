import { cookies } from 'next/headers';

import { BackendError, getLucroConfig, updateLucroConfig } from '../../../lib/backend';
import type { LucroConfigInput } from '../../../lib/lucro';

async function apiKey(): Promise<string | null> {
  return (await cookies()).get('admin_api_key')?.value ?? null;
}

function errorResponse(error: unknown) {
  const status = error instanceof BackendError ? error.status : 502;
  const message =
    error instanceof BackendError ? error.message : 'Não foi possível conectar à API.';
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const key = await apiKey();
  if (!key) return Response.json({ error: 'Sessão expirada.' }, { status: 401 });

  try {
    return Response.json(await getLucroConfig(key));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const key = await apiKey();
  if (!key) return Response.json({ error: 'Sessão expirada.' }, { status: 401 });

  try {
    const config = (await request.json()) as LucroConfigInput;
    return Response.json(await updateLucroConfig(key, config));
  } catch (error) {
    return errorResponse(error);
  }
}
