import { TypedRoute } from '@nestia/core';
import {
  Body,
  Controller,
  Header,
  HttpCode,
  Inject,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AdminApiConfig, isValidAdminApiKey } from './admin-auth.guard.js';
import {
  AdminSessionService,
  adminSessionMaxAge,
  cookieToken,
  requireAdminRequestHeader,
} from './admin-session.service.js';
import {
  type AdminSessionInput,
  AdminSessionInputSchema,
  type AdminSessionResponse,
} from './admin-session.dto.js';

@ApiTags('Administração / Sessão')
@Controller('v1/admin/session')
export class AdminSessionController {
  constructor(
    @Inject(AdminApiConfig) private readonly config: AdminApiConfig,
    @Inject(AdminSessionService) private readonly sessions: AdminSessionService,
  ) {}

  @TypedRoute.Post()
  @Header('Cache-Control', 'no-store')
  async create(
    @Body({ schema: AdminSessionInputSchema }) body: AdminSessionInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AdminSessionResponse> {
    requireAdminRequestHeader(request.headers['x-admin-request']);
    await this.sessions.checkAttempts(request.ip);
    const { apiKey } = body;
    if (!isValidAdminApiKey(apiKey, this.config)) {
      await this.sessions.failedAttempt(request.ip);
      throw new UnauthorizedException('API key inválida.');
    }
    await this.sessions.clearAttempts(request.ip);
    await this.sessions.revoke(cookieToken(request.headers.cookie));
    reply.header(
      'set-cookie',
      this.sessions.cookie(await this.sessions.create(), adminSessionMaxAge),
    );
    return { ok: true };
  }

  @TypedRoute.Get()
  @Header('Cache-Control', 'no-store')
  async status(@Req() request: FastifyRequest): Promise<AdminSessionResponse> {
    if (!(await this.sessions.valid(cookieToken(request.headers.cookie))))
      throw new UnauthorizedException();
    return { ok: true };
  }

  @TypedRoute.Delete()
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  async destroy(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    requireAdminRequestHeader(request.headers['x-admin-request']);
    await this.sessions.revoke(cookieToken(request.headers.cookie));
    reply.header('set-cookie', this.sessions.cookie('', 0));
  }
}
