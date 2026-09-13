import { randomBytes } from 'node:crypto';

import * as database from '@futhub/database';
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

import { upsertDiscordUser } from '../users/user.repository.js';
import { type PlayerSession, createPlayerSession, readPlayerSession } from './player-session.js';

type DiscordProfile = Readonly<{ avatarUrl: string | null; id: string; name: string }>;

const discordApiUrl = 'https://discord.com/api/v10';
const discordAuthorizeUrl = 'https://discord.com/oauth2/authorize';
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

@Injectable()
export class PlayerAuthService {
  authorizationUrl(): Readonly<{ state: string; url: string }> {
    const config = this.config();
    const state = randomBytes(32).toString('base64url');
    const url = new URL(discordAuthorizeUrl);
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
    }).toString();
    return { state, url: url.toString() };
  }

  async createSession(code: string): Promise<PlayerSession> {
    const config = this.config();
    const accessToken = await exchangeCode(code, config);
    const profile = await loadDiscordProfile(accessToken);
    const user = await database.db.transaction((tx) =>
      upsertDiscordUser(tx, database.schema, profile, new Date()),
    );
    return {
      avatarUrl: profile.avatarUrl,
      balance: user.balance,
      expiresAt: Date.now() + sessionMaxAgeSeconds * 1000,
      id: profile.id,
      name: profile.name,
    };
  }

  session(value: string | undefined): PlayerSession {
    const session = readPlayerSession(value, this.config().sessionSecret);
    if (!session) throw new UnauthorizedException();
    return session;
  }

  serialize(session: PlayerSession): string {
    return createPlayerSession(session, this.config().sessionSecret);
  }

  playerAppUrl(): string {
    return this.config().appUrl;
  }

  sessionMaxAge(): number {
    return sessionMaxAgeSeconds;
  }

  private config(): PlayerAuthConfig {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.PLAYER_DISCORD_REDIRECT_URI;
    const appUrl = process.env.PLAYER_APP_URL;
    const sessionSecret = process.env.PLAYER_SESSION_SECRET;
    if (!clientId || !clientSecret || !redirectUri || !appUrl || !sessionSecret)
      throw new ServiceUnavailableException('Autenticação de jogador não configurada.');
    return { appUrl, clientId, clientSecret, redirectUri, sessionSecret };
  }
}

type PlayerAuthConfig = Readonly<{
  appUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
}>;

async function exchangeCode(code: string, config: PlayerAuthConfig): Promise<string> {
  const response = await fetch(`${discordApiUrl}/oauth2/token`, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  const data = await readJson(response);
  if (!response.ok || !isRecord(data) || typeof data.access_token !== 'string')
    throw new UnauthorizedException('Não foi possível validar login Discord.');
  return data.access_token;
}

async function loadDiscordProfile(accessToken: string): Promise<DiscordProfile> {
  const response = await fetch(`${discordApiUrl}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await readJson(response);
  if (!response.ok || !isRecord(data) || typeof data.id !== 'string')
    throw new UnauthorizedException('Não foi possível carregar perfil Discord.');
  const name = typeof data.global_name === 'string' ? data.global_name : data.username;
  if (typeof name !== 'string' || !name.trim())
    throw new UnauthorizedException('Perfil Discord sem nome válido.');
  const avatarUrl =
    typeof data.avatar === 'string'
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128`
      : null;
  return { avatarUrl, id: data.id, name: name.trim() };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
