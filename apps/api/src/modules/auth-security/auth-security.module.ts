import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityAuditService } from './security-audit.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import {
  ConsoleEmailProvider,
  EMAIL_PROVIDER,
  SmtpEmailProvider,
  type EmailProvider,
} from './email-provider';
import { AuthSecurityController } from './auth-security.controller';

/**
 * Global so AuthService can inject SecurityAuditService without re-importing.
 *
 * EmailProvider selection: when `SMTP_HOST` is set, swap to the SMTP
 * provider; otherwise stay on the console provider. The SMTP provider is a
 * skeleton today — concrete `nodemailer` wiring is one follow-up commit
 * (see docs/AUTH_SECURITY.md).
 */
@Global()
@Module({
  controllers: [AuthSecurityController],
  providers: [
    SecurityAuditService,
    EmailVerificationService,
    PasswordResetService,
    ConsoleEmailProvider,
    SmtpEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, ConsoleEmailProvider, SmtpEmailProvider],
      useFactory: (
        config: ConfigService,
        consoleProvider: ConsoleEmailProvider,
        smtpProvider: SmtpEmailProvider,
      ): EmailProvider => {
        return config.get<string>('SMTP_HOST') ? smtpProvider : consoleProvider;
      },
    },
  ],
  exports: [SecurityAuditService, EmailVerificationService, PasswordResetService, EMAIL_PROVIDER],
})
export class AuthSecurityModule {}
