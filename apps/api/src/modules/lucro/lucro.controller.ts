import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import { Body, Controller, HttpCode, Inject, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import {
  type DiscordIdentityDto,
  DiscordIdentityDtoSchema,
  type LucroResponse,
} from './lucro.dto.js';
import { ResgatarLucroUseCase } from './use-cases/resgatar-lucro/resgatar-lucro.use-case.js';

@ApiTags('Comandos')
@Controller('v1/commands')
@UseGuards(InternalAuthGuard)
export class LucroController {
  constructor(
    @Inject(ResgatarLucroUseCase)
    private readonly resgatarLucro: ResgatarLucroUseCase,
  ) {}

  /**
   * Executa o comando lucro.
   *
   * @param identity Identidade atual do usuário Discord.
   * @returns Recompensa concedida ou cooldown ativo.
   */
  @TypedRoute.Post('lucro')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'executeLucro';
    route.security = [{ bearer: [] }];
  })
  async execute(
    @Body({ schema: DiscordIdentityDtoSchema }) identity: DiscordIdentityDto,
  ): Promise<LucroResponse> {
    const result = await this.resgatarLucro.execute(identity);
    return { ...result, availableAt: result.availableAt.toISOString() };
  }
}
