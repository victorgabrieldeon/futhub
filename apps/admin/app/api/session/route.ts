import { cookies } from 'next/headers';

import { BackendError, getLucroConfig } from '../../../lib/backend';

const cookieOptions = {
  httpOnly: true,
  maxAge: 60 * 60 * 8,
  path: '/',
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const apiKey =
    typeof body === 'object' && body !== null && 'apiKey' in body && typeof body.apiKey === 'string'
      ? body.apiKey.trim()
      : '';
  if (!apiKey) return Response.json({ error: 'Informe API key.' }, { status: 400 });

  try {
    await getLucroConfig(apiKey);
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 502;
    const message =
      error instanceof BackendError ? error.message : 'Não foi possível conectar à API.';
    return Response.json({ error: message }, { status });
  }

  (await cookies()).set('admin_api_key', apiKey, cookieOptions);
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete('admin_api_key');
  return Response.json({ ok: true });
}
