import { Body, Controller, Get, Inject, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

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
  @ApiOkResponse({ standardSchema: LucroConfigDtoSchema })
  get(): Promise<LucroConfigDto> {
    return this.lucro.get();
  }

  @Get('schema')
  @ApiOkResponse({ standardSchema: LucroEmbedSchemaDtoSchema })
  schema(): LucroEmbedSchemaDto {
    return this.lucro.schema();
  }

  @Put()
  @ApiOkResponse({ standardSchema: LucroConfigDtoSchema })
  update(
    @Body({ schema: LucroConfigInputDtoSchema }) input: LucroConfigInputDto,
  ): Promise<LucroConfigDto> {
    return this.lucro.update(input);
  }
}
