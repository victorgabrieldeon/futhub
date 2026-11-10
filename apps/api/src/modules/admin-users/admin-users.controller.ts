import { TypedRoute } from '@nestia/core';
import { Body, Controller, Inject, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import {
  type AdminUserBalanceInput,
  AdminUserBalanceInputSchema,
  type AdminUserCardsInput,
  AdminUserCardsInputSchema,
  type AdminUserDetail,
  type AdminUserListQuery,
  AdminUserListQuerySchema,
  type AdminUserOptions,
  type AdminUserPackInput,
  AdminUserPackInputSchema,
  type AdminUserPage,
  type AdminUserProfileInput,
  AdminUserProfileInputSchema,
} from './admin-users.dto.js';
import { AdminUsersService } from './admin-users.service.js';

@ApiTags('Administração / Usuários')
@Controller('v1/admin/users')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly users: AdminUsersService) {}

  @TypedRoute.Get()
  list(
    @Query({ schema: AdminUserListQuerySchema }) query: AdminUserListQuery,
  ): Promise<AdminUserPage> {
    return this.users.list(query);
  }

  @TypedRoute.Get('options')
  options(): Promise<AdminUserOptions> {
    return this.users.options();
  }

  @TypedRoute.Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @TypedRoute.Put(':id')
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserProfileInputSchema }) input: AdminUserProfileInput,
  ): Promise<AdminUserDetail> {
    return this.users.updateProfile(id, input);
  }

  @TypedRoute.Post(':id/balance')
  adjustBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserBalanceInputSchema }) input: AdminUserBalanceInput,
  ): Promise<AdminUserDetail> {
    return this.users.adjustBalance(id, input);
  }

  @TypedRoute.Post(':id/cards')
  addCards(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserCardsInputSchema }) input: AdminUserCardsInput,
  ): Promise<AdminUserDetail> {
    return this.users.addCards(id, input);
  }

  @TypedRoute.Delete(':id/cards/:userCardId')
  removeCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userCardId', ParseUUIDPipe) userCardId: string,
  ): Promise<AdminUserDetail> {
    return this.users.removeCard(id, userCardId);
  }

  @TypedRoute.Put(':id/packs/:packId')
  setPack(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('packId', ParseUUIDPipe) packId: string,
    @Body({ schema: AdminUserPackInputSchema }) input: AdminUserPackInput,
  ): Promise<AdminUserDetail> {
    return this.users.setPack(id, packId, input);
  }

  @TypedRoute.Put(':id/fields/:fieldId')
  grantField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ): Promise<AdminUserDetail> {
    return this.users.grantField(id, fieldId);
  }

  @TypedRoute.Delete(':id/fields/:fieldId')
  revokeField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ): Promise<AdminUserDetail> {
    return this.users.revokeField(id, fieldId);
  }
}
