import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminMissionsController } from './admin-missions.controller.js';
import { AdminMissionsService } from './admin-missions.service.js';
import { MissionsController } from './missions.controller.js';
import { MissionsService } from './missions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MissionsController, AdminMissionsController],
  providers: [
    AdminMissionsService,
    {
      provide: MissionsService,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new MissionsService(() => import('@futhub/database'));
      },
    },
  ],
})
export class MissionsModule {}
