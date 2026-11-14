import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';
import { configureApiClient } from '@futhub/api-client';

export type Identity = Readonly<{ avatarUrl: string | null; id: string; name: string }>;
export type PlayerSession = Identity & Readonly<{ balance: number; token: string }>;
type ActivityConfig = Readonly<{ clientId: string; storageHost: string | null }>;

/** Discord abre a Activity num iframe com `frame_id` na query. */
export const isActivity = new URLSearchParams(window.location.search).has('frame_id');

let pending: Promise<PlayerSession | null> | undefined;

/** Memoizado: StrictMode roda o efeito duas vezes e o SDK não aceita `authorize` em paralelo. */
export function loadSession(): Promise<PlayerSession | null> {
  pending ??= (isActivity ? activitySession() : webSession()).then(
    (session) => {
      // Bearer em vez de cookie: no iframe da Activity o cookie é de terceiro e não chega.
      if (session) configureApiClient({ baseUrl: window.location.origin, token: session.token });
      return session;
    },
    (error: unknown) => {
      pending = undefined;
      throw error;
    },
  );
  return pending;
}

export async function logout(): Promise<void> {
  pending = undefined;
  await fetch('/v1/auth/player/session', { method: 'DELETE' });
}

export function identityOf({ avatarUrl, id, name }: PlayerSession): Identity {
  return { avatarUrl, id, name };
}

async function webSession(): Promise<PlayerSession | null> {
  const response = await fetch('/v1/auth/player/session');
  if (!response.ok) return null;
  const data: unknown = await response.json();
  return isPlayerSession(data) ? data : null;
}

async function activitySession(): Promise<PlayerSession> {
  const config = await fetch('/v1/auth/player/activity').then((response) =>
    response.ok ? (response.json() as Promise<ActivityConfig>) : null,
  );
  if (!config?.clientId) throw new Error('Activity não configurada.');
  const { clientId } = config;
  patchExternalUrls(config.storageHost);
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    prompt: 'none',
    response_type: 'code',
    scope: ['identify'],
    state: '',
  });
  const response = await fetch('/v1/auth/player/activity', {
    body: JSON.stringify({ code }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !isPlayerSession(data) || !hasAccessToken(data))
    throw new Error('Não foi possível entrar com Discord.');
  await sdk.commands.authenticate({ access_token: data.accessToken });
  return data;
}

/**
 * O iframe da Activity só acessa hosts mapeados em URL Mappings no Developer Portal.
 * Mapeie `/storage` → host do MinIO público e `/discord-cdn` → cdn.discordapp.com.
 */
function patchExternalUrls(storage: string | null): void {
  patchUrlMappings(
    [
      { prefix: '/discord-cdn', target: 'cdn.discordapp.com' },
      ...(storage ? [{ prefix: '/storage', target: storage }] : []),
    ],
    { patchSrcAttributes: true },
  );
}

function isPlayerSession(value: unknown): value is PlayerSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === 'string' &&
    typeof session.name === 'string' &&
    (typeof session.avatarUrl === 'string' || session.avatarUrl === null) &&
    typeof session.balance === 'number' &&
    typeof session.token === 'string'
  );
}

function hasAccessToken(value: object): value is { accessToken: string } {
  return 'accessToken' in value && typeof value.accessToken === 'string';
}
