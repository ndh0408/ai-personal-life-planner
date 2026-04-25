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
import { EmailTemplateService } from './email-template.service';
import { AuthSecurityController } from './auth-security.controller';

/**
 * Global so AuthService can inject SecurityAuditService without re-importing.
 *
 * EmailProvider selection (round 17): keyed on `EMAIL_PROVIDER` env. The
 * production env validation (`env.validation.ts`) refuses to start when
 * `EMAIL_PROVIDER=smtp` and any of SMTP_HOST/USER/PASS/FROM are missing,
 * so the factory below can trust that the smtp branch is fully configured.
 */
@Global()
@Module({
  controllers: [AuthSecurityController],
  providers: [
    SecurityAuditService,
    EmailVerificationService,
    PasswordResetService,
    EmailTemplateService,
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
        return config.get<string>('EMAIL_PROVIDER') === 'smtp'
          ? smtpProvider
          : consoleProvider;
      },
    },
  ],
  exports: [
    SecurityAuditService,
    EmailVerificationService,
    PasswordResetService,
    EmailTemplateService,
    EMAIL_PROVIDER,
  ],
})
export class AuthSecurityModule {}
