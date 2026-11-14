import '@fastify/multipart';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { imageFile } from '../files/files.service.js';
import {
  type AdminPack,
  type AdminPackInput,
  AdminPackInputSchema,
  AdminPackSchema,
} from './admin-packs.dto.js';
import { AdminPacksService } from './admin-packs.service.js';

@ApiTags('Administração / Packs')
@Controller('v1/admin/packs')
@UseGuards(AdminAuthGuard)
export class AdminPacksController {
  constructor(@Inject(AdminPacksService) private readonly packs: AdminPacksService) {}

  @Get()
  @ApiOperation({ operationId: 'listAdminPacks', summary: 'Lista Packs' })
  @ApiOkResponse({ standardSchema: z.array(AdminPackSchema) })
  list(): Promise<AdminPack[]> {
    return this.packs.list();
  }

  @Post()
  @ApiOperation({ operationId: 'createAdminPack', summary: 'Cria um Pack' })
  @ApiCreatedResponse({ standardSchema: AdminPackSchema })
  create(@Body({ schema: AdminPackInputSchema }) input: AdminPackInput): Promise<AdminPack> {
    return this.packs.create(input);
  }

  @Put(':id')
  @ApiOperation({ operationId: 'updateAdminPack', summary: 'Atualiza um Pack' })
  @ApiOkResponse({ standardSchema: AdminPackSchema })
  update(
    @Param('id') id: string,
    @Body({ schema: AdminPackInputSchema }) input: AdminPackInput,
  ): Promise<AdminPack> {
    return this.packs.update(id, input);
  }

  @Put(':id/image')
  @ApiOperation({ operationId: 'uploadAdminPackImage', summary: 'Envia a imagem de um Pack' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOkResponse({ standardSchema: AdminPackSchema })
  async uploadImage(@Param('id') id: string, @Req() request: FastifyRequest): Promise<AdminPack> {
    const file = await request.file();
    if (!file) throw new BadRequestException('Image file is required.');
    return this.packs.uploadImage(id, imageFile(await file.toBuffer(), file.mimetype));
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteAdminPack', summary: 'Remove um Pack' })
  @ApiOkResponse({ standardSchema: AdminPackSchema })
  remove(@Param('id') id: string): Promise<AdminPack> {
    return this.packs.disable(id);
  }
}
