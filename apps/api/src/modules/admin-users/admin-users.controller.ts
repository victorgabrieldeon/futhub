import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import {
  type AdminUserBalanceInput,
  AdminUserBalanceInputSchema,
  type AdminUserCardsInput,
  AdminUserCardsInputSchema,
  type AdminUserDetail,
  AdminUserDetailSchema,
  type AdminUserListQuery,
  AdminUserListQuerySchema,
  type AdminUserOptions,
  AdminUserOptionsSchema,
  type AdminUserPackInput,
  AdminUserPackInputSchema,
  type AdminUserPage,
  AdminUserPageSchema,
  type AdminUserProfileInput,
  AdminUserProfileInputSchema,
} from './admin-users.dto.js';
import { AdminUsersService } from './admin-users.service.js';

@ApiTags('Administração / Usuários')
@Controller('v1/admin/users')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly users: AdminUsersService) {}

  @Get()
  @ApiOkResponse({ standardSchema: AdminUserPageSchema })
  list(
    @Query({ schema: AdminUserListQuerySchema }) query: AdminUserListQuery,
  ): Promise<AdminUserPage> {
    return this.users.list(query);
  }

  @Get('options')
  @ApiOkResponse({ standardSchema: AdminUserOptionsSchema })
  options(): Promise<AdminUserOptions> {
    return this.users.options();
  }

  @Get(':id')
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Put(':id')
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserProfileInputSchema }) input: AdminUserProfileInput,
  ): Promise<AdminUserDetail> {
    return this.users.updateProfile(id, input);
  }

  @Post(':id/balance')
  @ApiCreatedResponse({ standardSchema: AdminUserDetailSchema })
  adjustBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserBalanceInputSchema }) input: AdminUserBalanceInput,
  ): Promise<AdminUserDetail> {
    return this.users.adjustBalance(id, input);
  }

  @Post(':id/cards')
  @ApiCreatedResponse({ standardSchema: AdminUserDetailSchema })
  addCards(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserCardsInputSchema }) input: AdminUserCardsInput,
  ): Promise<AdminUserDetail> {
    return this.users.addCards(id, input);
  }

  @Delete(':id/cards/:userCardId')
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  removeCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userCardId', ParseUUIDPipe) userCardId: string,
  ): Promise<AdminUserDetail> {
    return this.users.removeCard(id, userCardId);
  }

  @Put(':id/packs/:packId')
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  setPack(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('packId', ParseUUIDPipe) packId: string,
    @Body({ schema: AdminUserPackInputSchema }) input: AdminUserPackInput,
  ): Promise<AdminUserDetail> {
    return this.users.setPack(id, packId, input);
  }

  @Put(':id/fields/:fieldId')
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  grantField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ): Promise<AdminUserDetail> {
    return this.users.grantField(id, fieldId);
  }

  @Delete(':id/fields/:fieldId')
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  revokeField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ): Promise<AdminUserDetail> {
    return this.users.revokeField(id, fieldId);
  }
}
