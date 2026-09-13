import { createHmac, timingSafeEqual } from 'node:crypto';

export type PlayerSession = Readonly<{
  avatarUrl: string | null;
  balance: number;
  expiresAt: number;
  id: string;
  name: string;
}>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createPlayerSession(value: PlayerSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function readPlayerSession(value: string | undefined, secret: string): PlayerSession | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !isSignatureValid(payload, signature, secret)) return null;

  try {
    const parsed: unknown = JSON.parse(decoder.decode(Buffer.from(payload, 'base64url')));
    return isPlayerSession(parsed) && parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function isSignatureValid(payload: string, signature: string, secret: string): boolean {
  const expected = encoder.encode(sign(payload, secret));
  const received = encoder.encode(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function isPlayerSession(value: unknown): value is PlayerSession {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (typeof value.avatarUrl === 'string' || value.avatarUrl === null) &&
    typeof value.balance === 'number' &&
    Number.isFinite(value.balance) &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
