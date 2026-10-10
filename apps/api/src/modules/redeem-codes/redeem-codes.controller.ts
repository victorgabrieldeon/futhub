import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import { Body, Controller, HttpCode, Inject, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import {
  type ResgatarCodigoInputDto,
  ResgatarCodigoInputSchema,
  type ResgatarCodigoResponse,
} from './redeem-codes.dto.js';
import { ResgatarCodigoUseCase } from './use-cases/resgatar-codigo/resgatar-codigo.use-case.js';

@ApiTags('Comandos')
@Controller('v1/commands')
@UseGuards(InternalAuthGuard)
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
  @TypedRoute.Post('resgatar')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'redeemCode';
    route.security = [{ bearer: [] }];
  })
  execute(
    @Body({ schema: ResgatarCodigoInputSchema }) input: ResgatarCodigoInputDto,
  ): Promise<ResgatarCodigoResponse> {
    return this.resgatarCodigo.execute(input);
  }
}
