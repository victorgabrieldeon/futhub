import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlayerOrInternalAuthGuard } from '../auth/player-auth.guard.js';
import {
  type ResgatarCodigoInputDto,
  ResgatarCodigoInputSchema,
  type ResgatarCodigoResponse,
  ResgatarCodigoResponseSchema,
} from './redeem-codes.dto.js';
import { ResgatarCodigoUseCase } from './use-cases/resgatar-codigo/resgatar-codigo.use-case.js';

@ApiTags('Comandos')
@ApiBearerAuth('bearer')
@Controller('v1/commands')
@UseGuards(PlayerOrInternalAuthGuard)
export class RedeemCodesController {
  constructor(
    @Inject(ResgatarCodigoUseCase)
    private readonly resgatarCodigo: ResgatarCodigoUseCase,
  ) {}

  /**
   * Resgata um Código de resgate para o jogador.
   *
   * @param input Identidade Discord e código digitado.
   * @returns Item concedido ou motivo da recusa.
   */
  @Post('resgatar')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'redeemCode',
    summary: 'Resgata um Código de resgate para o jogador.',
  })
  @ApiOkResponse({
    standardSchema: ResgatarCodigoResponseSchema,
    description: 'Item concedido ou motivo da recusa.',
  })
  execute(
    @Body({ schema: ResgatarCodigoInputSchema }) input: ResgatarCodigoInputDto,
  ): Promise<ResgatarCodigoResponse> {
    return this.resgatarCodigo.execute(input);
  }
}
