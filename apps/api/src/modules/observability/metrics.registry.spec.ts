import { MetricsRegistry, classifyEmailFailure } from './metrics.registry';

describe('MetricsRegistry', () => {
  it('exposes the round-18 metric series with low-cardinality labels', () => {
    const r = new MetricsRegistry();
    // Inc once so the series is created in the registry's dump.
    r.emailSendTotal.inc({ provider: 'console', status: 'ok', template: 'verify-email', locale: 'vi' });
    r.emailSendFailureTotal.inc({ provider: 'smtp', reason: 'timeout' });
    r.aiQuotaBlockTotal.inc({ feature: 'CHAT' });
    r.queueDepthGauge.set({ queue: 'notification-queue', state: 'waiting' }, 3);
    r.walArchiveStaleSeconds.set(42);
    r.backupAgeSeconds.set(3600);

    const text = r.registry.metrics() as unknown as string | Promise<string>;
    // prom-client returns a Promise in newer versions; await sync wrapper.
    return Promise.resolve(text).then((dump: string) => {
      expect(dump).toContain('lifeos_email_send_total{');
      expect(dump).toContain('lifeos_email_send_failure_total{');
      expect(dump).toContain('lifeos_ai_quota_block_total{');
      expect(dump).toContain('lifeos_queue_depth{');
      expect(dump).toContain('lifeos_wal_archive_stale_seconds');
      expect(dump).toContain('lifeos_backup_age_seconds');
      // Cardinality discipline — no label value contains an email or uuid.
      expect(dump).not.toMatch(/@/);
      expect(dump).not.toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-/);
    });
  });
});

describe('classifyEmailFailure', () => {
  it('maps timeout', () => {
    expect(classifyEmailFailure(new Error('connect ETIMEDOUT 1.2.3.4:587'))).toBe('timeout');
  });
  it('maps auth (530 / 535)', () => {
    expect(classifyEmailFailure(new Error('535 5.7.0 Auth failed'))).toBe('auth');
  });
  it('maps invalid_address', () => {
    expect(classifyEmailFailure(new Error('invalid recipient address'))).toBe('invalid_address');
  });
  it('falls back to other for unknown errors', () => {
    expect(classifyEmailFailure(new Error('something weird'))).toBe('other');
  });
  it('handles non-Error inputs safely', () => {
    expect(classifyEmailFailure('string err')).toBe('other');
    expect(classifyEmailFailure(undefined)).toBe('other');
  });
});
