import { Injectable } from '@nestjs/common';

/**
 * Notification template registry. Maps a notification `type` + locale →
 * { title, body }. Body strings receive `{{key}}` interpolation from the
 * `data` payload at send time.
 *
 * v1.0 ships a small starter set covering the most common notifications;
 * more can be added without touching the dispatcher / worker.
 */
type TemplateKey =
  | 'recommendation.high'
  | 'recommendation.daily'
  | 'reminder.task'
  | 'reminder.habit'
  | 'reminder.meal'
  | 'reminder.sleep'
  | 'reminder.mood'
  | 'finance.budget_alert'
  | 'goal.progress'
  | 'assistant.nudge'
  | 'generic';

type Locale = 'vi' | 'en';

const TEMPLATES: Record<TemplateKey, Record<Locale, { title: string; body: string }>> = {
  'recommendation.high': {
    vi: { title: 'Gợi ý quan trọng', body: '{{title}}' },
    en: { title: 'Important suggestion', body: '{{title}}' },
  },
  'recommendation.daily': {
    vi: { title: 'Gợi ý hôm nay', body: '{{title}}' },
    en: { title: "Today's suggestion", body: '{{title}}' },
  },
  'reminder.task': {
    vi: { title: 'Nhắc task', body: '{{title}}' },
    en: { title: 'Task reminder', body: '{{title}}' },
  },
  'reminder.habit': {
    vi: { title: 'Nhắc thói quen', body: '{{title}}' },
    en: { title: 'Habit reminder', body: '{{title}}' },
  },
  'reminder.meal': {
    vi: { title: 'Đến giờ ăn', body: '{{title}}' },
    en: { title: 'Meal time', body: '{{title}}' },
  },
  'reminder.sleep': {
    vi: { title: 'Tới giờ nghỉ ngơi', body: '{{title}}' },
    en: { title: 'Wind down time', body: '{{title}}' },
  },
  'reminder.mood': {
    vi: { title: 'Bạn cảm thấy thế nào?', body: '{{title}}' },
    en: { title: 'How are you feeling?', body: '{{title}}' },
  },
  'finance.budget_alert': {
    vi: { title: 'Cảnh báo ngân sách', body: '{{title}}' },
    en: { title: 'Budget alert', body: '{{title}}' },
  },
  'goal.progress': {
    vi: { title: 'Tiến độ mục tiêu', body: '{{title}}' },
    en: { title: 'Goal progress', body: '{{title}}' },
  },
  'assistant.nudge': {
    vi: { title: 'LifeOS gợi ý', body: '{{title}}' },
    en: { title: 'LifeOS nudge', body: '{{title}}' },
  },
  generic: {
    vi: { title: '{{title}}', body: '{{body}}' },
    en: { title: '{{title}}', body: '{{body}}' },
  },
};

@Injectable()
export class NotificationTemplateService {
  isKnown(key: string): key is TemplateKey {
    return Object.prototype.hasOwnProperty.call(TEMPLATES, key);
  }

  render(
    keyRaw: string,
    locale: string | undefined,
    data: Record<string, unknown> = {},
    fallbackTitle?: string,
    fallbackBody?: string,
  ): { title: string; body: string } {
    const key: TemplateKey = this.isKnown(keyRaw) ? keyRaw : 'generic';
    const loc: Locale = locale === 'en' ? 'en' : 'vi';
    const tpl = TEMPLATES[key][loc];
    return {
      title: interpolate(tpl.title, { ...data, title: fallbackTitle ?? data.title ?? '' }),
      body: interpolate(tpl.body, { ...data, title: fallbackTitle ?? data.title ?? '', body: fallbackBody ?? data.body ?? '' }),
    };
  }
}

function interpolate(template: string, values: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, k) => {
    const v = values[k];
    return v === undefined || v === null ? '' : String(v);
  });
}
