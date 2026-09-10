import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { FilesModule } from '../files/files.module.js';
import { AdminPacksController } from './admin-packs.controller.js';
import { AdminPacksService } from './admin-packs.service.js';

@Module({
  imports: [AuthModule, FilesModule],
  controllers: [AdminPacksController],
  providers: [AdminPacksService],
  exports: [AdminPacksService],
})
export class AdminPacksModule {}
