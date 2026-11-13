import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  type ActivityCodeRequest,
  ActivityCodeRequestSchema,
  type ActivityConfig,
  ActivityConfigSchema,
  type ActivitySessionResponse,
  ActivitySessionResponseSchema,
  type PlayerSessionResponse,
  PlayerSessionResponseSchema,
} from './player-auth.dto.js';

import { PlayerAuthService } from './player-auth.service.js';

const sessionCookieName = 'futhub_player_session';
const stateCookieName = 'futhub_discord_oauth_state';

@ApiTags('Autenticação do jogador')
@Controller('v1/auth/player')
export class PlayerAuthController {
  constructor(@Inject(PlayerAuthService) private readonly auth: PlayerAuthService) {}

  @Get('discord')
  @ApiExcludeEndpoint()
  start(@Res() reply: FastifyReply): void {
    const { state, url } = this.auth.authorizationUrl();
    reply.header('set-cookie', this.cookie(stateCookieName, state, 10 * 60));
    reply.redirect(url);
  }

  @Get('discord/callback')
  @ApiExcludeEndpoint()
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

  /** Config pública da Activity, lida em runtime para o build do front não depender de env. */
  @Get('activity')
  @ApiOkResponse({ standardSchema: ActivityConfigSchema })
  activityConfig(): ActivityConfig {
    const storage = process.env.MINIO_PUBLIC_URL;
    return {
      clientId: this.auth.clientId(),
      storageHost: storage ? new URL(storage).host : null,
    };
  }

  /** Troca o código do Embedded App SDK; no iframe da Activity a sessão viaja como Bearer. */
  @Post('activity')
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: ActivitySessionResponseSchema })
  async activity(
    @Body({ schema: ActivityCodeRequestSchema }) { code }: ActivityCodeRequest,
  ): Promise<ActivitySessionResponse> {
    const { accessToken, ...session } = await this.auth.createSession(code, 'activity');
    return { ...session, accessToken, token: this.auth.serialize(session) };
  }

  @Get('session')
  @ApiOkResponse({ standardSchema: PlayerSessionResponseSchema })
  session(@Req() request: FastifyRequest): PlayerSessionResponse {
    const token = this.cookieValue(request, sessionCookieName);
    if (!token) throw new UnauthorizedException();
    // token: o cliente usa Bearer nas rotas de jogo, igual na Activity.
    return { ...this.auth.session(token), token };
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
