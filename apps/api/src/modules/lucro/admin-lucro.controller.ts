import { Body, Controller, Get, Inject, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import {
  type LucroConfigDto,
  LucroConfigDtoSchema,
  type LucroConfigInputDto,
  LucroConfigInputDtoSchema,
  type LucroEmbedSchemaDto,
  LucroEmbedSchemaDtoSchema,
} from './admin-lucro.dto.js';
import { AdminLucroService } from './admin-lucro.service.js';

@ApiTags('Administração / Lucro')
@Controller('v1/admin/lucro')
@UseGuards(AdminAuthGuard)
export class AdminLucroController {
  constructor(@Inject(AdminLucroService) private readonly lucro: AdminLucroService) {}

  @Get()
  @ApiOperation({ operationId: 'getLucroConfig', summary: 'Lê a configuração do comando de lucro' })
  @ApiOkResponse({ standardSchema: LucroConfigDtoSchema })
  get(): Promise<LucroConfigDto> {
    return this.lucro.get();
  }

  @Get('schema')
  @ApiOperation({
    operationId: 'getLucroEmbedSchema',
    summary: 'Lê as variáveis disponíveis no embed de lucro',
  })
  @ApiOkResponse({ standardSchema: LucroEmbedSchemaDtoSchema })
  schema(): LucroEmbedSchemaDto {
    return this.lucro.schema();
  }

  @Put()
  @ApiOperation({
    operationId: 'updateLucroConfig',
    summary: 'Salva a configuração do comando de lucro',
  })
  @ApiOkResponse({ standardSchema: LucroConfigDtoSchema })
  update(
    @Body({ schema: LucroConfigInputDtoSchema }) input: LucroConfigInputDto,
  ): Promise<LucroConfigDto> {
    return this.lucro.update(input);
  }
}
