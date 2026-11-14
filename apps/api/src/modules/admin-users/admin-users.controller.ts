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
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

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
  @ApiOperation({ operationId: 'listAdminUsers', summary: 'Lista jogadores' })
  @ApiOkResponse({ standardSchema: AdminUserPageSchema })
  list(
    @Query({ schema: AdminUserListQuerySchema }) query: AdminUserListQuery,
  ): Promise<AdminUserPage> {
    return this.users.list(query);
  }

  @Get('options')
  @ApiOperation({
    operationId: 'getAdminUserOptions',
    summary: 'Lista Cards, Packs e campos para editar jogadores',
  })
  @ApiOkResponse({ standardSchema: AdminUserOptionsSchema })
  options(): Promise<AdminUserOptions> {
    return this.users.options();
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getAdminUser', summary: 'Lê o perfil completo de um jogador' })
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Put(':id')
  @ApiOperation({ operationId: 'updateAdminUser', summary: 'Atualiza o perfil de um jogador' })
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserProfileInputSchema }) input: AdminUserProfileInput,
  ): Promise<AdminUserDetail> {
    return this.users.updateProfile(id, input);
  }

  @Post(':id/balance')
  @ApiOperation({ operationId: 'adjustAdminUserBalance', summary: 'Ajusta o saldo de um jogador' })
  @ApiCreatedResponse({ standardSchema: AdminUserDetailSchema })
  adjustBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserBalanceInputSchema }) input: AdminUserBalanceInput,
  ): Promise<AdminUserDetail> {
    return this.users.adjustBalance(id, input);
  }

  @Post(':id/cards')
  @ApiOperation({ operationId: 'addAdminUserCards', summary: 'Concede Cards a um jogador' })
  @ApiCreatedResponse({ standardSchema: AdminUserDetailSchema })
  addCards(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AdminUserCardsInputSchema }) input: AdminUserCardsInput,
  ): Promise<AdminUserDetail> {
    return this.users.addCards(id, input);
  }

  @Delete(':id/cards/:userCardId')
  @ApiOperation({ operationId: 'removeAdminUserCard', summary: 'Remove um Card de um jogador' })
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  removeCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userCardId', ParseUUIDPipe) userCardId: string,
  ): Promise<AdminUserDetail> {
    return this.users.removeCard(id, userCardId);
  }

  @Put(':id/packs/:packId')
  @ApiOperation({
    operationId: 'setAdminUserPack',
    summary: 'Define a quantidade de um Pack de um jogador',
  })
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  setPack(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('packId', ParseUUIDPipe) packId: string,
    @Body({ schema: AdminUserPackInputSchema }) input: AdminUserPackInput,
  ): Promise<AdminUserDetail> {
    return this.users.setPack(id, packId, input);
  }

  @Put(':id/fields/:fieldId')
  @ApiOperation({ operationId: 'grantAdminUserField', summary: 'Concede um campo a um jogador' })
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  grantField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ): Promise<AdminUserDetail> {
    return this.users.grantField(id, fieldId);
  }

  @Delete(':id/fields/:fieldId')
  @ApiOperation({ operationId: 'revokeAdminUserField', summary: 'Remove um campo de um jogador' })
  @ApiOkResponse({ standardSchema: AdminUserDetailSchema })
  revokeField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ): Promise<AdminUserDetail> {
    return this.users.revokeField(id, fieldId);
  }
}
