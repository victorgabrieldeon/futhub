import { Global, Module } from '@nestjs/common';

import { AdminApiConfig, AdminAuthGuard } from './admin-auth.guard.js';
import { AdminSessionController } from './admin-session.controller.js';
import { AdminSessionService } from './admin-session.service.js';
import { InternalApiConfig, InternalAuthGuard } from './internal-auth.guard.js';

@Global()
@Module({
  controllers: [AdminSessionController],
  providers: [
    { provide: InternalApiConfig, useFactory: () => InternalApiConfig.fromEnvironment() },
    { provide: AdminApiConfig, useFactory: () => AdminApiConfig.fromEnvironment() },
    AdminSessionService,
    AdminAuthGuard,
    InternalAuthGuard,
  ],
  exports: [
    AdminApiConfig,
    AdminAuthGuard,
    AdminSessionService,
    InternalApiConfig,
    InternalAuthGuard,
  ],
})
export class AuthModule {}
