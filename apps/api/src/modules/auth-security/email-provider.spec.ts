import { ConsoleEmailProvider, SmtpEmailProvider, redactAddress } from './email-provider';
import type { ConfigService } from '@nestjs/config';

describe('redactAddress', () => {
  it('keeps the first letter + domain', () => {
    expect(redactAddress('huy@example.com')).toBe('h***@example.com');
  });
  it('handles missing @ safely', () => {
    expect(redactAddress('not-an-email')).toBe('***');
  });
});

describe('ConsoleEmailProvider', () => {
  it('does not throw on send', async () => {
    const p = new ConsoleEmailProvider();
    await expect(
      p.send({
        to: 'huy@example.com',
        subject: 'hi',
        text: 'this is the body\nwith a link to https://example.com/secret',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('SmtpEmailProvider config validation', () => {
  function makeConfig(env: Record<string, string | number | boolean>): ConfigService {
    return { get: <T>(k: string) => env[k] as T | undefined } as ConfigService;
  }

  it('does NOT build a transporter when EMAIL_PROVIDER != smtp (deferred)', () => {
    const p = new SmtpEmailProvider(makeConfig({ EMAIL_PROVIDER: 'console' }));
    p.onModuleInit();
    // Without onModuleInit having built one, send() throws our explicit
    // configuration error rather than passing junk to nodemailer.
    return expect(
      p.send({ to: 'h@example.com', subject: 's', text: 't' }),
    ).rejects.toThrow(/SmtpEmailProvider/);
  });

  it('logs warn but does not throw at boot when EMAIL_PROVIDER=smtp without SMTP_HOST', () => {
    const p = new SmtpEmailProvider(makeConfig({ EMAIL_PROVIDER: 'smtp' }));
    expect(() => p.onModuleInit()).not.toThrow();
  });
});
