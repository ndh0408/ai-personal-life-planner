import type { ParseHit, ParseContext, RuleParser } from './types';
import { resolveLocalIso } from './datetime';
import { vnWord } from './word';

const MOOD_KEYWORDS: Array<[RegExp, 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD']> = [
  [vnWord(['tuyệt', 'cực vui', 'hạnh phúc', 'great', 'amazing']), 'GREAT'],
  [vnWord(['vui', 'ổn', 'okay', 'good', 'tốt']), 'GOOD'],
  [vnWord(['bình thường', 'tạm', 'ok', 'okay']), 'OK'],
  [vnWord(['mệt', 'kiệt sức', 'đuối', 'tired', 'exhausted']), 'TIRED'],
  [vnWord(['stress', 'căng thẳng', 'áp lực', 'stressed']), 'STRESSED'],
  [vnWord(['buồn', 'chán', 'sad', 'down']), 'SAD'],
];

const MOOD_TRIGGER = vnWord(['mood', 'cảm thấy', 'tâm trạng', 'hôm nay', 'cảm xúc']);
const ENERGY_HIGH = vnWord(['năng lượng cao', 'hăng', 'sung sức', 'high']);
const ENERGY_LOW = vnWord(['uể oải', 'năng lượng thấp', 'low', 'đuối', 'mệt']);

const EMOJI: Record<string, string> = {
  GREAT: '🤩',
  GOOD: '🙂',
  OK: '😐',
  TIRED: '😴',
  STRESSED: '😬',
  SAD: '😞',
};

export class MoodParser implements RuleParser {
  match(text: string, ctx: ParseContext): ParseHit | null {
    let mood: 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD' | null = null;
    for (const [re, m] of MOOD_KEYWORDS) {
      if (re.test(text)) {
        mood = m;
        break;
      }
    }
    if (!mood) return null;

    const trigger = MOOD_TRIGGER.test(text);
    const energy = ENERGY_HIGH.test(text) ? 'HIGH' : ENERGY_LOW.test(text) ? 'LOW' : 'MEDIUM';

    const loggedAtIso = resolveLocalIso(text, ctx.now, ctx.tz, {
      defaultHour: new Date(ctx.now).getHours(),
      defaultMinute: 0,
    });

    // Mood-only words are ambiguous (e.g. "tốt" could be many things). Trigger lifts confidence.
    const confidence = trigger ? 0.85 : 0.55;

    return {
      kind: 'MOOD',
      source: 'RULE',
      confidence,
      fields: { mood, energy, loggedAtIso },
      previewText: `${EMOJI[mood]} ${mood.toLowerCase()}`,
    };
  }
}
