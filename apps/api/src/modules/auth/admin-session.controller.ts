import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AdminApiConfig, isValidAdminApiKey } from './admin-auth.guard.js';
import {
  type AdminSessionInput,
  AdminSessionInputSchema,
  type AdminSessionResponse,
  AdminSessionResponseSchema,
} from './admin-session.dto.js';
import {
  AdminSessionService,
  adminSessionMaxAge,
  cookieToken,
  requireAdminRequestHeader,
} from './admin-session.service.js';

@ApiTags('Administração / Sessão')
@Controller('v1/admin/session')
export class AdminSessionController {
  constructor(
    @Inject(AdminApiConfig) private readonly config: AdminApiConfig,
    @Inject(AdminSessionService) private readonly sessions: AdminSessionService,
  ) {}

  @Post()
  @ApiOperation({ operationId: 'createAdminSession', summary: 'Inicia a sessão administrativa' })
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ standardSchema: AdminSessionResponseSchema })
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

  @Get()
  @ApiOperation({ operationId: 'getAdminSession', summary: 'Lê a sessão administrativa atual' })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ standardSchema: AdminSessionResponseSchema })
  async status(@Req() request: FastifyRequest): Promise<AdminSessionResponse> {
    if (!(await this.sessions.valid(cookieToken(request.headers.cookie))))
      throw new UnauthorizedException();
    return { ok: true };
  }

  @Delete()
  @ApiOperation({ operationId: 'deleteAdminSession', summary: 'Encerra a sessão administrativa' })
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
