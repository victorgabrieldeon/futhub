import { Module } from '@nestjs/common';

import {
  DatabaseConfig,
  DrizzleResgatarLucroRepository,
  ResgatarLucroRepository,
} from './resgatar-lucro.repository.js';

@Module({
  providers: [
    { provide: DatabaseConfig, useFactory: () => DatabaseConfig.fromEnvironment() },
    { provide: ResgatarLucroRepository, useClass: DrizzleResgatarLucroRepository },
  ],
  exports: [ResgatarLucroRepository],
})
export class ResgatarLucroRepositoryModule {}
