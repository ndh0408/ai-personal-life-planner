/**
 * i18n parity guard (round 31).
 *
 * The vi locale is the source of truth — designs are written in
 * Vietnamese and en is a translation. This spec catches the most common
 * regressions:
 *   - A key landed in vi.json without an en counterpart (or vice versa).
 *   - A few load-bearing keys the redesigned R31 surfaces depend on
 *     are present in both locales.
 *
 * If these break the dev should add the missing copy rather than disable
 * the test — silent fall-through to the key string is what made the
 * pre-R31 UI look broken.
 */
import en from './locales/en.json';
import vi from './locales/vi.json';

type Bag = Record<string, unknown>;

function flatten(obj: Bag, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const inner of flatten(v as Bag, path)) out.add(inner);
    } else {
      out.add(path);
    }
  }
  return out;
}

describe('i18n locales', () => {
  const enKeys = flatten(en as Bag);
  const viKeys = flatten(vi as Bag);

  it('every Vietnamese key has an English counterpart', () => {
    const missing = [...viKeys].filter((k) => !enKeys.has(k));
    if (missing.length > 0) {
      // Emit a readable diff so the dev can paste-and-go.
      // eslint-disable-next-line no-console
      console.error('Missing in en.json:\n' + missing.join('\n'));
    }
    expect(missing).toEqual([]);
  });

  it('every English key has a Vietnamese counterpart', () => {
    const missing = [...enKeys].filter((k) => !viKeys.has(k));
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Missing in vi.json:\n' + missing.join('\n'));
    }
    expect(missing).toEqual([]);
  });

  // Spot-check the keys round-31 surfaces actually call into. These will
  // fire defaultValue if missing, but better to catch at test time than
  // ship a half-translated screen.
  const REQUIRED = [
    'common.undo',
    'common.useful',
    'common.dismiss',
    'capture.needsReview',
    'capture.undone',
    'capture.errors.undoFailed',
    'capture.alternatives.title',
    'capture.expenseCategories.food',
    'capture.incomeCategories.salary',
    'capture.fields.kind',
    'capture.fields.date',
    'assistant.stages.reading_snapshot',
    'assistant.stages.calling_llm',
    'assistant.stop',
    'assistant.regenerate',
    'privacy.title',
    'privacy.intro',
    'privacy.finance.title',
    'privacy.health.title',
    'home.smartBrief.label',
    'home.privacyLimited.title',
    'settings.privacyEntry',
    'settings.developer.env',
    'settings.developer.lastParse',
    'settings.developer.lastError',
  ];

  it.each(REQUIRED)('vi has %s', (key) => {
    expect(viKeys.has(key)).toBe(true);
  });

  it.each(REQUIRED)('en has %s', (key) => {
    expect(enKeys.has(key)).toBe(true);
  });
});
