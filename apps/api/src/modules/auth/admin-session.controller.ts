import { TypedRoute } from '@nestia/core';
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AdminApiConfig, adminApiKeyFromHeaders, isValidAdminApiKey } from './admin-auth.guard.js';
import {
  type AdminSessionInput,
  AdminSessionInputSchema,
  type AdminSessionResponse,
} from './admin-session.dto.js';

const sessionCookieName = 'admin_api_key';
const sessionMaxAgeSeconds = 60 * 60 * 8;

@ApiTags('Administração / Sessão')
@Controller('v1/admin/session')
export class AdminSessionController {
  constructor(@Inject(AdminApiConfig) private readonly config: AdminApiConfig) {}

  @TypedRoute.Post()
  create(
    @Body({ schema: AdminSessionInputSchema }) body: AdminSessionInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): AdminSessionResponse {
    const { apiKey } = body;
    if (!isValidAdminApiKey(apiKey, this.config))
      throw new UnauthorizedException('API key inválida.');
    reply.header('set-cookie', this.sessionCookie(apiKey, sessionMaxAgeSeconds));
    return { ok: true };
  }

  @TypedRoute.Get()
  status(@Req() request: FastifyRequest): AdminSessionResponse {
    if (!isValidAdminApiKey(adminApiKeyFromHeaders(request.headers), this.config))
      throw new UnauthorizedException();
    return { ok: true };
  }

  @TypedRoute.Delete()
  @HttpCode(204)
  destroy(@Res({ passthrough: true }) reply: FastifyReply): void {
    reply.header('set-cookie', this.sessionCookie('', 0));
  }

  private sessionCookie(apiKey: string, maxAge: number): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${sessionCookieName}=${encodeURIComponent(apiKey)}; HttpOnly; Max-Age=${maxAge}; Path=/; SameSite=Strict${secure}`;
  }
}
