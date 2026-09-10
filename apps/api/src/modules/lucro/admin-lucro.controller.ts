import { Controller, Inject, UseGuards } from '@nestjs/common';
import { TypedBody, TypedRoute } from '@nestia/core';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import type {
  LucroConfigDto,
  LucroConfigInputDto,
  LucroEmbedSchemaDto,
} from './admin-lucro.dto.js';
import { AdminLucroService } from './admin-lucro.service.js';

@Controller('v1/admin/lucro')
@UseGuards(AdminAuthGuard)
export class AdminLucroController {
  constructor(@Inject(AdminLucroService) private readonly lucro: AdminLucroService) {}

  @TypedRoute.Get()
  get(): Promise<LucroConfigDto> {
    return this.lucro.get();
  }

  @TypedRoute.Get('schema')
  schema(): LucroEmbedSchemaDto {
    return this.lucro.schema();
  }

  @TypedRoute.Put()
  update(@TypedBody() input: LucroConfigInputDto): Promise<LucroConfigDto> {
    return this.lucro.update(input);
  }
}
