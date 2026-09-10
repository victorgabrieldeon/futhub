import { Module } from '@nestjs/common';

import { PlayerAuthController } from './player-auth.controller.js';
import { PlayerAuthService } from './player-auth.service.js';

@Module({
  controllers: [PlayerAuthController],
  providers: [PlayerAuthService],
})
export class PlayerAuthModule {}
