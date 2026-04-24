import { Body, Controller, HttpCode, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  type LoginInput,
  type RegisterInput,
  type RefreshTokenInput,
} from '@planner/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AuthService, type IssueContext } from './auth.service';

function ctxFromRequest(req: Request): IssueContext {
  return {
    userAgent: req.headers['user-agent'] ?? null,
    ipAddress: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null,
  };
}

/**
 * Auth endpoints are rate-limited more aggressively than the global throttler
 * to slow down brute-force / token-farming. Values are per IP, per minute.
 */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
@Throttle(AUTH_THROTTLE)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  register(@Body() body: RegisterInput, @Req() req: Request) {
    return this.auth.register(body, ctxFromRequest(req));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(LoginSchema))
  login(@Body() body: LoginInput, @Req() req: Request) {
    return this.auth.login(body, ctxFromRequest(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(RefreshTokenSchema))
  refresh(@Body() body: RefreshTokenInput, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, ctxFromRequest(req));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt-access'))
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logoutAll(user.id);
  }
}
