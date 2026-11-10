import { TypedRoute } from '@nestia/core';
import { Body, Controller, Inject, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminMissionsService } from './admin-missions.service.js';
import {
  type AdminMission,
  type AdminMissionInput,
  AdminMissionInputSchema,
  type AdminMissionOptions,
} from './missions.dto.js';

@ApiTags('Administração / Missões')
@Controller('v1/admin/missions')
@UseGuards(AdminAuthGuard)
export class AdminMissionsController {
  constructor(@Inject(AdminMissionsService) private readonly missions: AdminMissionsService) {}

  @TypedRoute.Get()
  list(): Promise<AdminMission[]> {
    return this.missions.list();
  }

  @TypedRoute.Get('options')
  options(): Promise<AdminMissionOptions> {
    return this.missions.options();
  }

  @TypedRoute.Post()
  create(
    @Body({ schema: AdminMissionInputSchema }) input: AdminMissionInput,
  ): Promise<AdminMission> {
    return this.missions.create(input);
  }

  @TypedRoute.Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: AdminMissionInputSchema }) input: AdminMissionInput,
  ): Promise<AdminMission> {
    return this.missions.update(id, input);
  }

  @TypedRoute.Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminMission> {
    return this.missions.remove(id);
  }
}
