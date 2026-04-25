import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { MetricsRegistry, classifyEmailFailure } from '../observability/metrics.registry';

export type Email = {
  to: string;
  subject: string;
  text: string;
  /** Optional html body. Providers should fall back to text if missing. */
  html?: string;
  /** Round 18: optional template + locale for metric labels (low cardinality). */
  template?: string;
  locale?: string;
};

/**
 * Pluggable email transport. Two implementations:
 *  - {@link ConsoleEmailProvider} — local-dev / test / smoke. Logs only the
 *    recipient + subject + first 120 chars of the body. Never the full
 *    text/html (would include verification/reset URLs).
 *  - {@link SmtpEmailProvider} — production. Uses nodemailer; configured
 *    via SMTP_HOST/USER/PASS/FROM env. Production env validation fails fast
 *    when `EMAIL_PROVIDER=smtp` and any of those are missing.
 *
 * The factory in AuthSecurityModule chooses based on `EMAIL_PROVIDER`.
 */
export interface EmailProvider {
  send(email: Email): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  // MetricsRegistry is @Optional so tests that construct the provider
  // directly (no Nest DI) don't need a stub.
  constructor(@Optional() private readonly metrics?: MetricsRegistry) {}

  async send(email: Email): Promise<void> {
    const preview = email.text.split('\n').slice(0, 2).join(' ').slice(0, 120);
    this.logger.log(
      `[email-console] to=${email.to.slice(0, 4)}…@${email.to.split('@')[1] ?? '?'} subject="${email.subject}" preview="${preview}"`,
    );
    this.metrics?.emailSendTotal.inc({
      provider: 'console',
      status: 'ok',
      template: email.template ?? 'unknown',
      locale: email.locale ?? 'unknown',
    });
  }
}

/**
 * Real SMTP transport via nodemailer.
 *
 * Operational notes:
 * - Pool: a single shared transporter, lazily built once at boot.
 * - Timeout: 10 s connect, 10 s socket, 15 s greeting. We'd rather fail an
 *   email than block the user-facing request indefinitely.
 * - Logging: NEVER includes SMTP_PASS, NEVER includes the full text/html
 *   body (verification + reset bodies contain links that shouldn't leak to
 *   ops logs). On failure we log the error class only, with `to=user@host`
 *   redacted to `u***@host`.
 * - Retry: nodemailer retries connect-level failures internally per
 *   transport options; the caller (EmailVerification/PasswordReset) is
 *   already idempotent (token persisted before send), so a send failure is
 *   recoverable by the user clicking "resend".
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider, OnModuleInit {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transporter: Transporter | null = null;
  private from: string | undefined;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: MetricsRegistry,
  ) {}

  onModuleInit(): void {
    // Build the transporter eagerly so a misconfig fails at boot, not on
    // the first user-facing send. A missing host here means EMAIL_PROVIDER
    // was wrong-value=smtp without env validation catching it (e.g. opt-in
    // test rig) — log warn and defer to send() which throws a clearer
    // message.
    if (this.config.get<string>('EMAIL_PROVIDER') !== 'smtp') return;
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP_HOST is empty — SMTP provider deferred until configured');
      return;
    }
    this.from = this.config.get<string>('SMTP_FROM');
    this.transporter = createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: this.config.get<boolean>('SMTP_SECURE') === true,
      auth: {
        user: this.config.get<string>('SMTP_USER') ?? '',
        pass: this.config.get<string>('SMTP_PASS') ?? '',
      },
      connectionTimeout: 10_000,
      greetingTimeout: 15_000,
      socketTimeout: 10_000,
      pool: true,
      maxConnections: 1,
      maxMessages: 100,
    });
    this.logger.log(
      `SMTP transporter ready (host=${host} from=${redactAddress(this.from ?? '')})`,
    );
  }

  async send(email: Email): Promise<void> {
    if (!this.transporter) {
      throw new Error('SmtpEmailProvider: transporter not initialised; check SMTP_HOST');
    }
    if (!this.from) {
      throw new Error('SmtpEmailProvider: SMTP_FROM is empty');
    }
    const tplLabel = email.template ?? 'unknown';
    const localeLabel = email.locale ?? 'unknown';
    const stop = this.metrics?.emailSendLatency.startTimer({
      provider: 'smtp',
      template: tplLabel,
    });
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html ?? undefined,
      });
      this.logger.log(
        `smtp send OK to=${redactAddress(email.to)} subject="${email.subject}"`,
      );
      this.metrics?.emailSendTotal.inc({
        provider: 'smtp',
        status: 'ok',
        template: tplLabel,
        locale: localeLabel,
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : 'Error';
      const msg = e instanceof Error ? e.message : String(e);
      // Strip multi-line server responses that could echo auth challenges.
      const safe = msg.split('\n')[0].slice(0, 200);
      this.logger.warn(
        `smtp send FAILED to=${redactAddress(email.to)} subject="${email.subject}" error=${name}: ${safe}`,
      );
      this.metrics?.emailSendTotal.inc({
        provider: 'smtp',
        status: 'failed',
        template: tplLabel,
        locale: localeLabel,
      });
      this.metrics?.emailSendFailureTotal.inc({
        provider: 'smtp',
        reason: classifyEmailFailure(e),
      });
      throw e;
    } finally {
      stop?.();
    }
  }
}

/** "user@gmail.com" → "u***@gmail.com" (redact local-part for logs). */
export function redactAddress(addr: string): string {
  const idx = addr.indexOf('@');
  if (idx <= 0) return '***';
  return `${addr.slice(0, 1)}***@${addr.slice(idx + 1)}`;
}
