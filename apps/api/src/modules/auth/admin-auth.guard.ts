import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AdminSessionService,
  cookieToken,
  requireAdminRequestHeader,
} from './admin-session.service.js';

type AdminHeaders = Readonly<{
  authorization?: string;
  cookie?: string;
  'x-admin-request'?: string;
}>;

export class AdminApiConfig {
  constructor(readonly token: string) {}

  static fromEnvironment(): AdminApiConfig {
    const token = process.env.ADMIN_API_TOKEN;
    if (!token) throw new Error('ADMIN_API_TOKEN is required.');
    return new AdminApiConfig(token);
  }
}

export function adminApiKeyFromHeaders(headers: AdminHeaders): string | undefined {
  if (headers.authorization?.startsWith('Bearer ')) return headers.authorization.slice(7);
  return undefined;
}

export function isValidAdminApiKey(apiKey: string | undefined, config: AdminApiConfig): boolean {
  if (!apiKey) return false;
  const received = Buffer.from(apiKey);
  const expected = Buffer.from(config.token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(AdminApiConfig) private readonly config: AdminApiConfig,
    @Inject(AdminSessionService) private readonly sessions: AdminSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: AdminHeaders; method: string }>();
    if (isValidAdminApiKey(adminApiKeyFromHeaders(request.headers), this.config)) return true;
    if (!(await this.sessions.valid(cookieToken(request.headers.cookie))))
      throw new UnauthorizedException();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method))
      requireAdminRequestHeader(request.headers['x-admin-request']);
    return true;
  }
}
