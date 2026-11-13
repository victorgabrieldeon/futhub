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
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({ standardSchema: z.array(AdminMissionSchema) })
  list(): Promise<AdminMission[]> {
    return this.missions.list();
  }

  @Get('options')
  @ApiOkResponse({ standardSchema: AdminMissionOptionsSchema })
  options(): Promise<AdminMissionOptions> {
    return this.missions.options();
  }

  @Post()
  @ApiCreatedResponse({ standardSchema: AdminMissionSchema })
  create(
    @Body({ schema: AdminMissionInputSchema }) input: AdminMissionInput,
  ): Promise<AdminMission> {
    return this.missions.create(input);
  }

  @Put(':id')
  @ApiOkResponse({ standardSchema: AdminMissionSchema })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: AdminMissionInputSchema }) input: AdminMissionInput,
  ): Promise<AdminMission> {
    return this.missions.update(id, input);
  }

  @Delete(':id')
  @ApiOkResponse({ standardSchema: AdminMissionSchema })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminMission> {
    return this.missions.remove(id);
  }
}
