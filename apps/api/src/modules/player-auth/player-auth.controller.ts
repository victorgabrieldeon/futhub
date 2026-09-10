import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { PlayerAuthService } from './player-auth.service.js';

const sessionCookieName = 'futhub_player_session';
const stateCookieName = 'futhub_discord_oauth_state';

@Controller('v1/auth/player')
export class PlayerAuthController {
  constructor(@Inject(PlayerAuthService) private readonly auth: PlayerAuthService) {}

  @Get('discord')
  start(@Res() reply: FastifyReply): void {
    const { state, url } = this.auth.authorizationUrl();
    reply.header('set-cookie', this.cookie(stateCookieName, state, 10 * 60));
    reply.redirect(url);
  }

  @Get('discord/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!code || !state || this.cookieValue(request, stateCookieName) !== state)
      throw new UnauthorizedException('Login Discord expirou. Tente novamente.');
    const session = await this.auth.createSession(code);
    reply.header('set-cookie', [
      this.cookie(sessionCookieName, this.auth.serialize(session), this.auth.sessionMaxAge()),
      this.cookie(stateCookieName, '', 0),
    ]);
    reply.redirect(this.auth.playerAppUrl());
  }

  @Get('session')
  session(@Req() request: FastifyRequest) {
    return this.auth.session(this.cookieValue(request, sessionCookieName));
  }

  @Delete('session')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) reply: FastifyReply): void {
    reply.header('set-cookie', this.cookie(sessionCookieName, '', 0));
  }

  private cookieValue(request: FastifyRequest, name: string): string | undefined {
    const pair = request.headers.cookie
      ?.split(';')
      .find((value) => value.trim().startsWith(`${name}=`));
    if (!pair) return undefined;
    try {
      return decodeURIComponent(pair.trim().slice(name.length + 1));
    } catch {
      return undefined;
    }
  }

  private cookie(name: string, value: string, maxAge: number): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${name}=${encodeURIComponent(value)}; HttpOnly; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  }
}
