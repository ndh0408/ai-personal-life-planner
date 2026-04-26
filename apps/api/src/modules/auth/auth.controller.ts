import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  LoginBody,
  LogoutBody,
  RefreshBody,
  RegisterBody,
  type LoginRequest,
  type LogoutRequest,
  type RefreshRequest,
  type RegisterRequest,
} from './dto';

function clientCtx(req: Request) {
  const ua = (req.headers['user-agent'] ?? '').toString().slice(0, 500) || undefined;
  const ip =
    (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      undefined) ?? undefined;
  return { userAgent: ua, ipAddress: ip };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Tighter rate limit on the credentialed endpoints — 10 req / minute / IP.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@RegisterBody() body: RegisterRequest, @Req() req: Request) {
    return this.auth.register(body, clientCtx(req));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@LoginBody() body: LoginRequest, @Req() req: Request) {
    return this.auth.login(body, clientCtx(req));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@RefreshBody() body: RefreshRequest, @Req() req: Request) {
    const tokens = await this.auth.refresh(body.refreshToken, clientCtx(req));
    return { tokens };
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthenticatedUser, @LogoutBody() body: LogoutRequest) {
    await this.auth.logout(user.id, body.refreshToken);
  }
}

@ApiTags('auth')
@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @ApiBearerAuth()
  @Get()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
