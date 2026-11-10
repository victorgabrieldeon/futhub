import { TypedRoute } from '@nestia/core';
import { Body, Controller, Inject, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminRedeemCodesService } from './admin-redeem-codes.service.js';
import {
  type AdminRedeemCode,
  type AdminRedeemCodeInput,
  AdminRedeemCodeInputSchema,
  type AdminRedeemCodeOptions,
} from './redeem-codes.dto.js';

@ApiTags('Administração / Códigos de resgate')
@Controller('v1/admin/redeem-codes')
@UseGuards(AdminAuthGuard)
export class AdminRedeemCodesController {
  constructor(
    @Inject(AdminRedeemCodesService) private readonly redeemCodes: AdminRedeemCodesService,
  ) {}

  @TypedRoute.Get()
  list(): Promise<AdminRedeemCode[]> {
    return this.redeemCodes.list();
  }

  @TypedRoute.Get('options')
  options(): Promise<AdminRedeemCodeOptions> {
    return this.redeemCodes.options();
  }

  @TypedRoute.Post()
  create(
    @Body({ schema: AdminRedeemCodeInputSchema }) input: AdminRedeemCodeInput,
  ): Promise<AdminRedeemCode> {
    return this.redeemCodes.create(input);
  }

  @TypedRoute.Put(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: AdminRedeemCodeInputSchema }) input: AdminRedeemCodeInput,
  ): Promise<AdminRedeemCode> {
    return this.redeemCodes.update(id, input);
  }

  @TypedRoute.Delete(':id')
  remove(@Param('id') id: string): Promise<AdminRedeemCode> {
    return this.redeemCodes.remove(id);
  }
}
