import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({ standardSchema: z.array(AdminRedeemCodeSchema) })
  list(): Promise<AdminRedeemCode[]> {
    return this.redeemCodes.list();
  }

  @Get('options')
  @ApiOkResponse({ standardSchema: AdminRedeemCodeOptionsSchema })
  options(): Promise<AdminRedeemCodeOptions> {
    return this.redeemCodes.options();
  }

  @Post()
  @ApiCreatedResponse({ standardSchema: AdminRedeemCodeSchema })
  create(
    @Body({ schema: AdminRedeemCodeInputSchema }) input: AdminRedeemCodeInput,
  ): Promise<AdminRedeemCode> {
    return this.redeemCodes.create(input);
  }

  @Put(':id')
  @ApiOkResponse({ standardSchema: AdminRedeemCodeSchema })
  update(
    @Param('id') id: string,
    @Body({ schema: AdminRedeemCodeInputSchema }) input: AdminRedeemCodeInput,
  ): Promise<AdminRedeemCode> {
    return this.redeemCodes.update(id, input);
  }

  @Delete(':id')
  @ApiOkResponse({ standardSchema: AdminRedeemCodeSchema })
  remove(@Param('id') id: string): Promise<AdminRedeemCode> {
    return this.redeemCodes.remove(id);
  }
}
