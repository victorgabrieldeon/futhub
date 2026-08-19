import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PacksModule } from './modules/packs/packs.module.js';
import { LucroModule } from './modules/lucro/lucro.module.js';

@Module({
  imports: [AuthModule, HealthModule, LucroModule, PacksModule],
})
export class AppModule {}
