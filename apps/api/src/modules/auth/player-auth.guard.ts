import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { readPlayerSession } from '../player-auth/player-session.js';
import { InternalApiConfig, isValidInternalToken } from './internal-auth.guard.js';

type PlayerRequest = {
  body?: unknown;
  headers: { authorization?: string };
  params?: Record<string, string>;
};

/**
 * Aceita o token interno (bot) ou a sessão de jogador (web/Activity).
 * Para jogador, a identidade vem sempre da sessão assinada, nunca do cliente.
 */
@Injectable()
export class PlayerOrInternalAuthGuard implements CanActivate {
  constructor(@Inject(InternalApiConfig) private readonly config: InternalApiConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PlayerRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = authorization.slice(7);
    if (isValidInternalToken(token, this.config)) return true;

    const secret = process.env.PLAYER_SESSION_SECRET;
    const session = secret ? readPlayerSession(token, secret) : null;
    if (!session) throw new UnauthorizedException();
    const identity = { id: session.id, name: session.name, avatarUrl: session.avatarUrl };

    const discordUserId = request.params?.discordUserId;
    if (discordUserId !== undefined && discordUserId !== identity.id)
      throw new ForbiddenException();
    const body = request.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return true;
    const fields = body as Record<string, unknown>;
    if ('identity' in fields) fields.identity = identity;
    // Rotas cuja identidade é o próprio body (lucro, clube, liga, missões).
    if ('id' in fields) {
      if (fields.id !== identity.id) throw new ForbiddenException();
      Object.assign(fields, identity);
    }
    return true;
  }
}
