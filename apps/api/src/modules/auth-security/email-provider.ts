import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Email = {
  to: string;
  subject: string;
  text: string;
  /** Optional html body. Providers should fall back to text if missing. */
  html?: string;
};

/**
 * Pluggable email transport. Default in v1.4 is the console provider so a
 * fresh clone runs end-to-end without SMTP credentials. Production sets
 * SMTP env vars to switch to a real transport (skeleton below).
 */
export interface EmailProvider {
  send(email: Email): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

/**
 * Local-dev provider. Logs only the recipient + subject + first 80 chars of
 * the text body — never the full body and never the verification token URL
 * (callers must pass the URL inside `text`/`html`, not as metadata).
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(email: Email): Promise<void> {
    const preview = email.text.split('\n').slice(0, 2).join(' ').slice(0, 120);
    this.logger.log(
      `[email-console] to=${email.to.slice(0, 4)}…@${email.to.split('@')[1] ?? '?'} subject="${email.subject}" preview="${preview}"`,
    );
  }
}

/**
 * SMTP provider skeleton. Concrete `nodemailer` wiring is intentionally
 * deferred (no transitive crypto bumps in this round); the env contract is
 * declared so the operator can switch by setting `SMTP_HOST` etc.
 *
 * To enable: `npm i nodemailer @types/nodemailer` then replace the throw.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(_email: Email): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      throw new Error('SmtpEmailProvider: SMTP_HOST is not configured');
    }
    // Wiring left out on purpose. See docs/AUTH_SECURITY.md.
    throw new Error('SmtpEmailProvider not implemented in this build');
  }
}
