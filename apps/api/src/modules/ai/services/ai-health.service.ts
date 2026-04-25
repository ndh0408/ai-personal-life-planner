import { Injectable } from '@nestjs/common';
import type { Locale } from '../prompts/system';

/**
 * Health-advisory helper.
 *
 * This service does NOT call the AI itself — it gates and shapes what the
 * other AI services are allowed to say about health topics. Centralizing the
 * logic here makes it easy to add detection for medical-emergency keywords,
 * under-sleep alerts, or any future safety net once we start receiving real
 * user content.
 */
@Injectable()
export class AiHealthService {
  /** Hard-coded safe fallback used when upstream AI returns something unsafe. */
  safeFallback(locale: Locale): string {
    return locale === 'en'
      ? 'Take care of yourself today. Prioritize sleep, hydration, and movement. For any medical concern, please consult a qualified professional.'
      : 'Hãy chăm sóc bản thân hôm nay — ưu tiên giấc ngủ, đủ nước và vận động nhẹ. Với bất kỳ lo lắng sức khoẻ nào, bạn nên hỏi ý kiến chuyên gia y tế.';
  }

  /**
   * Classic red-flag detector — extend as needed. Returns a non-null reason
   * when the caller should short-circuit to {@link safeFallback}.
   *
   * The keyword list covers BOTH English and Vietnamese, because the
   * upstream model's response is in the user's locale (see
   * `prompts/system.ts buildLanguageDirective`). An English-only screen
   * would miss "tự tử" / "kê đơn" / "liều dùng" in Vietnamese output.
   * Lowercase comparison after Unicode normalisation so accent variants
   * still match.
   */
  screenForUnsafeContent(text: string): string | null {
    const t = text.normalize('NFC').toLowerCase();
    const unsafeEn = [
      'self-harm',
      'suicide',
      'overdose',
      'prescription',
      'dosage',
      'diagnose',
    ];
    const unsafeVi = [
      'tự tử',
      'tự sát',
      'tự làm hại',
      'tự gây thương tích',
      'kê đơn',
      'liều dùng',
      'liều cao',
      'quá liều',
      'chẩn đoán',
      'thuốc kê đơn',
      'tự ý dùng thuốc',
    ];
    for (const keyword of [...unsafeEn, ...unsafeVi]) {
      if (t.includes(keyword)) return `contains-unsafe-keyword:${keyword}`;
    }
    return null;
  }

  /**
   * Sleep under-advisory. Pure utility used by planner/review prompts so the
   * same threshold lives in one place.
   */
  isUnderSlept(avgMinutes: number | null): boolean {
    return avgMinutes !== null && avgMinutes < 6 * 60;
  }
}
