import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlayerOrInternalAuthGuard } from '../auth/player-auth.guard.js';
import {
  type DiscordIdentityDto,
  DiscordIdentityDtoSchema,
  type LucroResponse,
  LucroResponseSchema,
} from './lucro.dto.js';
import { ResgatarLucroUseCase } from './use-cases/resgatar-lucro/resgatar-lucro.use-case.js';

@ApiTags('Comandos')
@ApiBearerAuth('bearer')
@Controller('v1/commands')
@UseGuards(PlayerOrInternalAuthGuard)
export class LucroController {
  constructor(
    @Inject(ResgatarLucroUseCase)
    private readonly resgatarLucro: ResgatarLucroUseCase,
  ) {}

  /** Executa o comando lucro: recompensa concedida ou cooldown ativo. */
  @Post('lucro')
  @HttpCode(200)
  @ApiOperation({ operationId: 'executeLucro' })
  @ApiOkResponse({ standardSchema: LucroResponseSchema })
  async execute(
    @Body({ schema: DiscordIdentityDtoSchema }) identity: DiscordIdentityDto,
  ): Promise<LucroResponse> {
    const result = await this.resgatarLucro.execute(identity);
    if (result.kind === 'cooldown')
      return { ...result, availableAt: result.availableAt.toISOString() };
    return {
      ...result,
      availableAt: result.availableAt.toISOString(),
      completedMissions: [...result.completedMissions],
    };
  }
}
