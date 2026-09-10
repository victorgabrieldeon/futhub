import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

type AdminHeaders = Readonly<{ authorization?: string; cookie?: string }>;

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
  const pair = headers.cookie
    ?.split(';')
    .find((value) => value.trim().startsWith('admin_api_key='));
  if (!pair) return undefined;
  try {
    return decodeURIComponent(pair.trim().slice('admin_api_key='.length));
  } catch {
    return undefined;
  }
}

export function isValidAdminApiKey(apiKey: string | undefined, config: AdminApiConfig): boolean {
  if (!apiKey) return false;
  const received = Buffer.from(apiKey);
  const expected = Buffer.from(config.token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(@Inject(AdminApiConfig) private readonly config: AdminApiConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: AdminHeaders }>();
    if (!isValidAdminApiKey(adminApiKeyFromHeaders(request.headers), this.config))
      throw new UnauthorizedException();
    return true;
  }
}
