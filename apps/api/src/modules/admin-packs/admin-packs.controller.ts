import '@fastify/multipart';
import { TypedRoute } from '@nestia/core';
import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { imageFile } from '../files/files.service.js';
import { type AdminPack, type AdminPackInput, AdminPackInputSchema } from './admin-packs.dto.js';
import { AdminPacksService } from './admin-packs.service.js';

@ApiTags('Administração / Packs')
@Controller('v1/admin/packs')
@UseGuards(AdminAuthGuard)
export class AdminPacksController {
  constructor(@Inject(AdminPacksService) private readonly packs: AdminPacksService) {}

  @TypedRoute.Get()
  list(): Promise<AdminPack[]> {
    return this.packs.list();
  }

  @TypedRoute.Post()
  create(@Body({ schema: AdminPackInputSchema }) input: AdminPackInput): Promise<AdminPack> {
    return this.packs.create(input);
  }

  @TypedRoute.Put(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: AdminPackInputSchema }) input: AdminPackInput,
  ): Promise<AdminPack> {
    return this.packs.update(id, input);
  }

  @Put(':id/image')
  async uploadImage(@Param('id') id: string, @Req() request: FastifyRequest): Promise<AdminPack> {
    const file = await request.file();
    if (!file) throw new BadRequestException('Image file is required.');
    return this.packs.uploadImage(id, imageFile(await file.toBuffer(), file.mimetype));
  }

  @TypedRoute.Delete(':id')
  remove(@Param('id') id: string): Promise<AdminPack> {
    return this.packs.disable(id);
  }
}
