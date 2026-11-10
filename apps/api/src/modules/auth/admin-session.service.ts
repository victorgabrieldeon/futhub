import { createHash, randomBytes } from 'node:crypto';

import { db, eq, pool, schema } from '@futhub/database';
import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';

export const adminSessionCookie =
  process.env.NODE_ENV === 'production' ? '__Host-futhub_admin_session' : 'futhub_admin_session';
export const adminSessionMaxAge = 8 * 60 * 60;

const loginWindowMinutes = 15;
const maxFailures = 10;

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function cookieToken(cookie: string | undefined): string | undefined {
  const pair = cookie
    ?.split(';')
    .find((value) => value.trim().startsWith(`${adminSessionCookie}=`));
  if (!pair) return undefined;
  const value = pair.trim().slice(adminSessionCookie.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}

export function requireAdminRequestHeader(value: string | string[] | undefined): void {
  if (value !== '1') throw new ForbiddenException('Requisição administrativa inválida.');
}

@Injectable()
export class AdminSessionService {
  async create(): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await db.insert(schema.adminSessions).values({
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + adminSessionMaxAge * 1000),
    });
    return token;
  }

  async valid(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const [session] = await db
      .select({ expiresAt: schema.adminSessions.expiresAt })
      .from(schema.adminSessions)
      .where(eq(schema.adminSessions.tokenHash, hash(token)));
    return Boolean(session && session.expiresAt.getTime() > Date.now());
  }

  async revoke(token: string | undefined): Promise<void> {
    if (token)
      await db.delete(schema.adminSessions).where(eq(schema.adminSessions.tokenHash, hash(token)));
  }

  async checkAttempts(clientIp: string): Promise<void> {
    const [row] = await db
      .select()
      .from(schema.adminLoginAttempts)
      .where(eq(schema.adminLoginAttempts.clientIp, clientIp));
    if (
      row &&
      row.failures >= maxFailures &&
      row.windowStart.getTime() > Date.now() - loginWindowMinutes * 60_000
    )
      throw new HttpException(
        'Muitas tentativas. Tente novamente em 15 minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  async failedAttempt(clientIp: string): Promise<void> {
    await pool.query(
      `INSERT INTO admin_login_attempts (client_ip, failures, window_start)
       VALUES ($1, 1, now())
       ON CONFLICT (client_ip) DO UPDATE SET
         failures = CASE WHEN admin_login_attempts.window_start < now() - interval '15 minutes'
           THEN 1 ELSE admin_login_attempts.failures + 1 END,
         window_start = CASE WHEN admin_login_attempts.window_start < now() - interval '15 minutes'
           THEN now() ELSE admin_login_attempts.window_start END`,
      [clientIp],
    );
  }

  async clearAttempts(clientIp: string): Promise<void> {
    await db
      .delete(schema.adminLoginAttempts)
      .where(eq(schema.adminLoginAttempts.clientIp, clientIp));
  }

  cookie(token: string, maxAge: number): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${adminSessionCookie}=${token}; HttpOnly; Max-Age=${maxAge}; Path=/; SameSite=Strict${secure}`;
  }
}
