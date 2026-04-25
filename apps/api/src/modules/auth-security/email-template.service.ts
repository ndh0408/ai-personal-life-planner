import { Injectable } from '@nestjs/common';

export type EmailTemplateKey = 'verify-email' | 'reset-password' | 'security-alert';

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

type Locale = 'vi' | 'en';

type Template = {
  subject: Record<Locale, string>;
  /** Plain-text body. Use `{{var}}` placeholders. */
  text: Record<Locale, string>;
};

const TEMPLATES: Record<EmailTemplateKey, Template> = {
  'verify-email': {
    subject: {
      vi: 'Xác minh email LifeOS',
      en: 'Verify your LifeOS email',
    },
    text: {
      vi: [
        'Xin chào {{name}},',
        '',
        'Vui lòng xác minh email bằng đường dẫn dưới đây:',
        '{{link}}',
        '',
        'Liên kết này hết hạn sau {{ttlHours}} giờ.',
        'Nếu bạn không tạo tài khoản, hãy bỏ qua email này.',
      ].join('\n'),
      en: [
        'Hi {{name}},',
        '',
        'Please verify your email by visiting:',
        '{{link}}',
        '',
        'This link expires in {{ttlHours}} hours.',
        "If you didn't create an account, you can ignore this email.",
      ].join('\n'),
    },
  },
  'reset-password': {
    subject: {
      vi: 'Đặt lại mật khẩu LifeOS',
      en: 'Reset your LifeOS password',
    },
    text: {
      vi: [
        'Xin chào {{name}},',
        '',
        'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản này.',
        '{{link}}',
        '',
        'Liên kết hết hạn sau {{ttlMinutes}} phút.',
        'Nếu bạn không yêu cầu, hãy bỏ qua email này.',
      ].join('\n'),
      en: [
        'Hi {{name}},',
        '',
        'We received a request to reset your password.',
        '{{link}}',
        '',
        'This link expires in {{ttlMinutes}} minutes.',
        "If you didn't request this, you can ignore this email.",
      ].join('\n'),
    },
  },
  'security-alert': {
    subject: {
      vi: 'Cảnh báo bảo mật LifeOS',
      en: 'LifeOS security alert',
    },
    text: {
      vi: [
        'Xin chào {{name}},',
        '',
        'Chúng tôi phát hiện một sự kiện bảo mật trên tài khoản của bạn:',
        '{{event}}',
        '',
        'Thời gian: {{when}}',
        'Nếu không phải bạn, vui lòng đặt lại mật khẩu ngay.',
      ].join('\n'),
      en: [
        'Hi {{name}},',
        '',
        'We detected a security event on your account:',
        '{{event}}',
        '',
        'When: {{when}}',
        "If this wasn't you, please reset your password immediately.",
      ].join('\n'),
    },
  },
};

/**
 * Renders i18n verification / reset / security email bodies. Lives outside
 * the EmailProvider so the provider stays a pure transport (easier to swap
 * SMTP→SES→Postmark without rewriting templates).
 *
 * Templates use `{{var}}` placeholders. Missing values render as empty
 * strings (we never crash on a missing field).
 *
 * Privacy: callers MUST inject the link/event metadata via `vars` — never
 * via the subject. The template never includes raw tokens; it only includes
 * the URL the operator constructs from the token.
 */
@Injectable()
export class EmailTemplateService {
  render(
    key: EmailTemplateKey,
    locale: string | undefined,
    vars: Record<string, string | number | undefined | null> = {},
  ): RenderedEmail {
    const tpl = TEMPLATES[key];
    if (!tpl) throw new Error(`unknown email template: ${key}`);
    const loc: Locale = locale === 'en' ? 'en' : 'vi';
    const text = interpolate(tpl.text[loc], vars);
    return {
      subject: interpolate(tpl.subject[loc], vars),
      text,
      html: textToHtml(text),
    };
  }
}

function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

function textToHtml(text: string): string {
  // Minimal escape + line-break → <br>. Good enough for a transactional
  // email; we don't want a templating engine pulled in for one use case.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}
