import { maybeStartOtel, __test } from './otel.bootstrap';

describe('maybeStartOtel', () => {
  const ORIG = process.env;
  afterEach(() => {
    process.env = { ...ORIG };
  });

  it('no-ops when OTEL_ENABLED is unset', async () => {
    delete process.env.OTEL_ENABLED;
    await expect(maybeStartOtel()).resolves.toBeUndefined();
  });

  it('no-ops when OTEL_ENABLED=false', async () => {
    process.env.OTEL_ENABLED = 'false';
    await expect(maybeStartOtel()).resolves.toBeUndefined();
  });

  it('returns silently when OTEL_ENABLED=true but endpoint missing', async () => {
    process.env.OTEL_ENABLED = 'true';
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    await expect(maybeStartOtel()).resolves.toBeUndefined();
  });

  it('returns silently when OTel SDK packages are not installed', async () => {
    process.env.OTEL_ENABLED = 'true';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    await expect(maybeStartOtel()).resolves.toBeUndefined();
  });

  it('redacts sensitive headers', () => {
    expect(__test.REDACTED_HEADERS).toEqual([
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
    ]);
  });
});
