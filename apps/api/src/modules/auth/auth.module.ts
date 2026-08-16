import { Global, Module } from '@nestjs/common';

import { InternalApiConfig, InternalAuthGuard } from './internal-auth.guard.js';

@Global()
@Module({
  providers: [
    { provide: InternalApiConfig, useFactory: () => InternalApiConfig.fromEnvironment() },
    InternalAuthGuard,
  ],
  exports: [InternalApiConfig, InternalAuthGuard],
})
export class AuthModule {}
