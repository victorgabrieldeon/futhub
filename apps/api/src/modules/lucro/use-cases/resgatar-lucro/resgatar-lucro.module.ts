import { Module } from '@nestjs/common';

import { ResgatarLucroRepositoryModule } from '../../repository/resgatar-lucro.module.js';
import {
  ResgatarLucroUseCase,
  SystemClock,
  SystemRandomSource,
} from './resgatar-lucro.use-case.js';
import { Clock, RandomSource } from './resgatar-lucro.types.js';

@Module({
  imports: [ResgatarLucroRepositoryModule],
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: RandomSource, useClass: SystemRandomSource },
    ResgatarLucroUseCase,
  ],
  exports: [ResgatarLucroUseCase],
})
export class ResgatarLucroUseCaseModule {}
