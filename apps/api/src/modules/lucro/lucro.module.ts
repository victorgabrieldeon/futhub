import { Module } from '@nestjs/common';

import { LucroController } from './lucro.controller.js';
import { ResgatarLucroUseCaseModule } from './use-cases/resgatar-lucro/resgatar-lucro.module.js';

@Module({
  imports: [ResgatarLucroUseCaseModule],
  controllers: [LucroController],
})
export class LucroModule {}
