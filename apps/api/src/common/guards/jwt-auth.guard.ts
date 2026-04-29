import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface AccessPayload {
  sub: string;
  email: string;
  type?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: { code: 'missing_token', message: 'Authorization header missing' },
      });
    }
    const token = auth.slice('Bearer '.length).trim();

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        error: { code: 'invalid_token', message: 'Access token is invalid or expired' },
      });
    }

    // Defence-in-depth: even though access and refresh use different secrets
    // today, a future config slip-up that aligned them must not make refresh
    // tokens accepted as access tokens. Reject anything that doesn't carry
    // type=access explicitly.
    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        error: { code: 'wrong_token_type', message: 'Wrong token type' },
      });
    }
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException({
        error: { code: 'invalid_token', message: 'Access token is invalid or expired' },
      });
    }

    (req as Request & { user: { id: string; email: string } }).user = {
      id: payload.sub,
      email: payload.email,
    };
    return true;
  }
}
