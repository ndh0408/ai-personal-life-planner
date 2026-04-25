import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
  const svc = new EmailTemplateService();

  it('renders verify-email vi with name + link + ttlHours', () => {
    const out = svc.render('verify-email', 'vi', {
      name: 'Huy',
      link: 'https://app/verify-email?token=abc',
      ttlHours: 24,
    });
    expect(out.subject).toBe('Xác minh email LifeOS');
    expect(out.text).toContain('Huy');
    expect(out.text).toContain('https://app/verify-email?token=abc');
    expect(out.text).toContain('24');
    expect(out.html).toContain('<br>');
  });

  it('renders verify-email en when locale=en', () => {
    const out = svc.render('verify-email', 'en', { name: 'Huy', link: 'X', ttlHours: 24 });
    expect(out.subject).toBe('Verify your LifeOS email');
    expect(out.text).toContain('Hi Huy');
  });

  it('falls back to vi when locale is missing', () => {
    const out = svc.render('verify-email', undefined, { name: 'Huy' });
    expect(out.subject).toBe('Xác minh email LifeOS');
  });

  it('renders reset-password with ttlMinutes', () => {
    const out = svc.render('reset-password', 'en', {
      name: 'Huy',
      link: 'L',
      ttlMinutes: 30,
    });
    expect(out.subject).toBe('Reset your LifeOS password');
    expect(out.text).toContain('30');
  });

  it('escapes HTML special chars in body', () => {
    const out = svc.render('verify-email', 'en', {
      name: '<script>alert(1)</script>',
      link: 'L',
      ttlHours: 1,
    });
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('missing variables render as empty (no crash)', () => {
    const out = svc.render('verify-email', 'en', {});
    expect(out.text).toContain('Hi ');
    expect(out.subject).toBe('Verify your LifeOS email');
  });

  it('throws on unknown template key', () => {
    // @ts-expect-error — testing the runtime guard
    expect(() => svc.render('not-a-key', 'en', {})).toThrow();
  });
});
