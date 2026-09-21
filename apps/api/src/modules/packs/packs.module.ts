import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { PackShopService } from './pack-shop.service.js';

import { PacksController } from './packs.controller.js';
import { DrizzlePackRepository } from './repository/packs.repository.js';
import { OpenPackUseCase } from './use-cases/open-pack/open-pack.use-case.js';
import { PackCatalogRepository, PackRepository } from './use-cases/pack.types.js';
import { PurchasePackUseCase } from './use-cases/purchase-pack/purchase-pack.use-case.js';

@Module({
  imports: [FilesModule],
  controllers: [PacksController],
  providers: [
    PackShopService,
    {
      provide: PackRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new DrizzlePackRepository(() => import('@futhub/database'));
      },
    },
    {
      provide: PackCatalogRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new DrizzlePackRepository(() => import('@futhub/database'));
      },
    },
    {
      provide: PurchasePackUseCase,
      inject: [PackRepository],
      useFactory: (repository: PackRepository) => new PurchasePackUseCase(repository),
    },
    {
      provide: OpenPackUseCase,
      inject: [PackRepository],
      useFactory: (repository: PackRepository) => new OpenPackUseCase(repository, Math.random),
    },
  ],
})
export class PacksModule {}
