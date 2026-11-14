import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminRedeemCodesService } from './admin-redeem-codes.service.js';
import {
  type AdminRedeemCode,
  type AdminRedeemCodeInput,
  AdminRedeemCodeInputSchema,
  type AdminRedeemCodeOptions,
  AdminRedeemCodeOptionsSchema,
  AdminRedeemCodeSchema,
} from './redeem-codes.dto.js';

@ApiTags('Administração / Códigos de resgate')
@Controller('v1/admin/redeem-codes')
@UseGuards(AdminAuthGuard)
export class AdminRedeemCodesController {
  constructor(
    @Inject(AdminRedeemCodesService) private readonly redeemCodes: AdminRedeemCodesService,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listAdminRedeemCodes', summary: 'Lista códigos de resgate' })
  @ApiOkResponse({ standardSchema: z.array(AdminRedeemCodeSchema) })
  list(): Promise<AdminRedeemCode[]> {
    return this.redeemCodes.list();
  }

  @Get('options')
  @ApiOperation({
    operationId: 'getAdminRedeemCodeOptions',
    summary: 'Lista Cards, Packs e campos concedidos por códigos',
  })
  @ApiOkResponse({ standardSchema: AdminRedeemCodeOptionsSchema })
  options(): Promise<AdminRedeemCodeOptions> {
    return this.redeemCodes.options();
  }

  @Post()
  @ApiOperation({ operationId: 'createAdminRedeemCode', summary: 'Cria um código de resgate' })
  @ApiCreatedResponse({ standardSchema: AdminRedeemCodeSchema })
  create(
    @Body({ schema: AdminRedeemCodeInputSchema }) input: AdminRedeemCodeInput,
  ): Promise<AdminRedeemCode> {
    return this.redeemCodes.create(input);
  }

  @Put(':id')
  @ApiOperation({ operationId: 'updateAdminRedeemCode', summary: 'Atualiza um código de resgate' })
  @ApiOkResponse({ standardSchema: AdminRedeemCodeSchema })
  update(
    @Param('id') id: string,
    @Body({ schema: AdminRedeemCodeInputSchema }) input: AdminRedeemCodeInput,
  ): Promise<AdminRedeemCode> {
    return this.redeemCodes.update(id, input);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteAdminRedeemCode', summary: 'Remove um código de resgate' })
  @ApiOkResponse({ standardSchema: AdminRedeemCodeSchema })
  remove(@Param('id') id: string): Promise<AdminRedeemCode> {
    return this.redeemCodes.remove(id);
  }
}
