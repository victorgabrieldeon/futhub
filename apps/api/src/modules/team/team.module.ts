import { Module } from '@nestjs/common';

import { FilesService } from '../files/files.service.js';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

@Module({
  controllers: [TeamController],
  providers: [
    {
      provide: TeamService,
      inject: [FilesService],
      useFactory: (files: FilesService) => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new TeamService(() => import('@futhub/database'), files);
      },
    },
  ],
})
export class TeamModule {}
