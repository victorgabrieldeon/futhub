import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalApiConfig {
  constructor(readonly token: string) {}

  static fromEnvironment(): InternalApiConfig {
    const token = process.env.API_INTERNAL_TOKEN;
    if (!token) throw new Error('API_INTERNAL_TOKEN is required.');
    return new InternalApiConfig(token);
  }
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(@Inject(InternalApiConfig) private readonly config: InternalApiConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const authorization = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>().headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
    if (!isValidInternalToken(authorization.slice(7), this.config))
      throw new UnauthorizedException();
    return true;
  }
}

export function isValidInternalToken(token: string, config: InternalApiConfig): boolean {
  const received = Buffer.from(token);
  const expected = Buffer.from(config.token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
