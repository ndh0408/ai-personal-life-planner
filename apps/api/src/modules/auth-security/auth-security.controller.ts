import { Body, Controller, HttpCode, Post, Req, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';

const ResendVerificationSchema = z.object({ email: z.string().email() }).strict();
const VerifyEmailSchema = z.object({ token: z.string().min(16).max(256) }).strict();
const ForgotPasswordSchema = z.object({ email: z.string().email() }).strict();
const ResetPasswordSchema = z
  .object({ token: z.string().min(16).max(256), password: z.string().min(8).max(128) })
  .strict();

function ctx(req: Request) {
  return {
    ipAddress:
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ??
      null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

/**
 * All endpoints under /auth/* are aggressively rate-limited (per-IP) by the
 * auth-security flow, *and* by the per-user controllers below. The throttle
 * decorator combined with the global per-IP guard is enough — there is no
 * extra service-level throttle.
 */
@Controller('auth')
export class AuthSecurityController {
  constructor(
    private readonly verification: EmailVerificationService,
    private readonly reset: PasswordResetService,
  ) {}

  @Post('resend-verification')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(ResendVerificationSchema))
  async resend(@Body() body: { email: string }, @Req() req: Request) {
    await this.verification.resend(body.email, ctx(req));
    return { status: 'queued' };
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(VerifyEmailSchema))
  async verify(@Body() body: { token: string }, @Req() req: Request) {
    return this.verification.verify(body.token, ctx(req));
  }

  @Post('forgot-password')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(ForgotPasswordSchema))
  async forgot(@Body() body: { email: string }, @Req() req: Request) {
    await this.reset.forgot(body.email, ctx(req));
    return { status: 'queued' };
  }

  @Post('reset-password')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(ResetPasswordSchema))
  async resetPassword(@Body() body: { token: string; password: string }, @Req() req: Request) {
    await this.reset.reset(body.token, body.password, ctx(req));
  }
}
