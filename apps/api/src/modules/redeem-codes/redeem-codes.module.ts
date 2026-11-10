import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminRedeemCodesController } from './admin-redeem-codes.controller.js';
import { AdminRedeemCodesService } from './admin-redeem-codes.service.js';
import { RedeemCodesController } from './redeem-codes.controller.js';
import { DrizzleResgatarCodigoRepository } from './repository/resgatar-codigo.repository.js';
import {
  Clock,
  ResgatarCodigoRepository,
} from './use-cases/resgatar-codigo/resgatar-codigo.types.js';
import { ResgatarCodigoUseCase } from './use-cases/resgatar-codigo/resgatar-codigo.use-case.js';

@Module({
  imports: [AuthModule],
  controllers: [RedeemCodesController, AdminRedeemCodesController],
  providers: [
    { provide: Clock, useValue: { now: () => new Date() } },
    AdminRedeemCodesService,
    {
      provide: ResgatarCodigoRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new DrizzleResgatarCodigoRepository(() => import('@futhub/database'));
      },
    },
    {
      provide: ResgatarCodigoUseCase,
      inject: [ResgatarCodigoRepository, Clock],
      useFactory: (repository: ResgatarCodigoRepository, clock: Clock) =>
        new ResgatarCodigoUseCase(repository, clock),
    },
  ],
})
export class RedeemCodesModule {}
