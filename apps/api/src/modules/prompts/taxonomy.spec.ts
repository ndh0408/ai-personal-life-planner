/**
 * Taxonomy invariants — validated through the api jest setup since the
 * taxonomy package itself has no test runner. If this file lights up red,
 * a downstream consumer (mobile / api / future watch app) will too.
 */
import {
  BILLING_TIERS,
  ENTITLEMENTS,
  TIER_PRICING_VND,
  PRIVACY_TIERS,
  PRIVACY_TIER_META,
  CAPTURE_KINDS,
  CAPTURE_KIND_META,
  EVENT_NAMES,
  isEventName,
} from '@lifeos/taxonomy';

describe('billing taxonomy', () => {
  it('every tier has entitlements + pricing', () => {
    for (const tier of BILLING_TIERS) {
      expect(ENTITLEMENTS[tier]).toBeDefined();
      expect(TIER_PRICING_VND[tier]).toBeDefined();
    }
  });

  it('FREE is the most restrictive', () => {
    expect(ENTITLEMENTS.FREE.byokAllowed).toBe(false);
    expect(ENTITLEMENTS.FREE.onDeviceLlmAllowed).toBe(false);
    expect(ENTITLEMENTS.FREE.maxDevices).toBe(1);
  });

  it('PRO unlocks BYOK + on-device LLM + bank sync', () => {
    expect(ENTITLEMENTS.PRO.byokAllowed).toBe(true);
    expect(ENTITLEMENTS.PRO.onDeviceLlmAllowed).toBe(true);
    expect(ENTITLEMENTS.PRO.bankCalendarSync).toBe(true);
  });

  it('LIFETIME entitlements equal PRO', () => {
    expect(ENTITLEMENTS.LIFETIME).toEqual(ENTITLEMENTS.PRO);
  });

  it('LIFETIME pricing is one-time only', () => {
    expect(TIER_PRICING_VND.LIFETIME.monthly).toBeNull();
    expect(TIER_PRICING_VND.LIFETIME.oneTime).toBe(2_990_000);
  });
});

describe('privacy taxonomy', () => {
  it('every tier has bilingual meta', () => {
    for (const tier of PRIVACY_TIERS) {
      const meta = PRIVACY_TIER_META[tier];
      expect(meta.labelVi.length).toBeGreaterThan(0);
      expect(meta.labelEn.length).toBeGreaterThan(0);
      expect(meta.descriptionVi.length).toBeGreaterThan(0);
    }
  });

  it('LOCAL disables cloud AI; CLOUD/HYBRID allow it', () => {
    expect(PRIVACY_TIER_META.LOCAL.cloudAi).toBe(false);
    expect(PRIVACY_TIER_META.CLOUD.cloudAi).toBe(true);
    expect(PRIVACY_TIER_META.HYBRID.cloudAi).toBe(true);
  });
});

describe('capture taxonomy', () => {
  it('every kind has bilingual meta + icon', () => {
    for (const kind of CAPTURE_KINDS) {
      const meta = CAPTURE_KIND_META[kind];
      expect(meta.labelVi.length).toBeGreaterThan(0);
      expect(meta.labelEn.length).toBeGreaterThan(0);
      expect(meta.iconName.length).toBeGreaterThan(0);
    }
  });
});

describe('event taxonomy', () => {
  it('isEventName narrows correctly', () => {
    expect(isEventName('capture.text.created')).toBe(true);
    expect(isEventName('not.a.real.event')).toBe(false);
    expect(isEventName(null)).toBe(false);
  });

  it('canonical surfaces are present', () => {
    expect(EVENT_NAMES).toContain('capture.classified');
    expect(EVENT_NAMES).toContain('privacy.tier.changed');
    expect(EVENT_NAMES).toContain('billing.byok.added');
  });
});
