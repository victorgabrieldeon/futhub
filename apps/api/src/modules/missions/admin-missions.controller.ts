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
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminMissionsService } from './admin-missions.service.js';
import {
  type AdminMission,
  type AdminMissionInput,
  AdminMissionInputSchema,
  type AdminMissionOptions,
  AdminMissionOptionsSchema,
  AdminMissionSchema,
} from './missions.dto.js';

@ApiTags('Administração / Missões')
@Controller('v1/admin/missions')
@UseGuards(AdminAuthGuard)
export class AdminMissionsController {
  constructor(@Inject(AdminMissionsService) private readonly missions: AdminMissionsService) {}

  @Get()
  @ApiOperation({ operationId: 'listAdminMissions', summary: 'Lista missões' })
  @ApiOkResponse({ standardSchema: z.array(AdminMissionSchema) })
  list(): Promise<AdminMission[]> {
    return this.missions.list();
  }

  @Get('options')
  @ApiOperation({
    operationId: 'getAdminMissionOptions',
    summary: 'Lista Cards, Packs e campos usados como recompensa',
  })
  @ApiOkResponse({ standardSchema: AdminMissionOptionsSchema })
  options(): Promise<AdminMissionOptions> {
    return this.missions.options();
  }

  @Post()
  @ApiOperation({ operationId: 'createAdminMission', summary: 'Cria uma missão' })
  @ApiCreatedResponse({ standardSchema: AdminMissionSchema })
  create(
    @Body({ schema: AdminMissionInputSchema }) input: AdminMissionInput,
  ): Promise<AdminMission> {
    return this.missions.create(input);
  }

  @Put(':id')
  @ApiOperation({ operationId: 'updateAdminMission', summary: 'Atualiza uma missão' })
  @ApiOkResponse({ standardSchema: AdminMissionSchema })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: AdminMissionInputSchema }) input: AdminMissionInput,
  ): Promise<AdminMission> {
    return this.missions.update(id, input);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteAdminMission', summary: 'Remove uma missão' })
  @ApiOkResponse({ standardSchema: AdminMissionSchema })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminMission> {
    return this.missions.remove(id);
  }
}
