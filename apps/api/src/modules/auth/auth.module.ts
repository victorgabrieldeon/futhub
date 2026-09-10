import { Global, Module } from '@nestjs/common';

import { AdminApiConfig, AdminAuthGuard } from './admin-auth.guard.js';
import { AdminSessionController } from './admin-session.controller.js';
import { InternalApiConfig, InternalAuthGuard } from './internal-auth.guard.js';

@Global()
@Module({
  controllers: [AdminSessionController],
  providers: [
    { provide: InternalApiConfig, useFactory: () => InternalApiConfig.fromEnvironment() },
    { provide: AdminApiConfig, useFactory: () => AdminApiConfig.fromEnvironment() },
    AdminAuthGuard,
    InternalAuthGuard,
  ],
  exports: [AdminApiConfig, AdminAuthGuard, InternalApiConfig, InternalAuthGuard],
})
export class AuthModule {}
