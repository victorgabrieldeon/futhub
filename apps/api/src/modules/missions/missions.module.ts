import { Module } from '@nestjs/common';

import { MissionsController } from './missions.controller.js';
import { MissionsService } from './missions.service.js';

@Module({
  controllers: [MissionsController],
  providers: [
    {
      provide: MissionsService,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new MissionsService(() => import('@dreamfut/database'));
      },
    },
  ],
})
export class MissionsModule {}
