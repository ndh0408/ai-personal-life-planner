/**
 * OpenTelemetry bootstrap — dynamic import so the SDK is NOT a hard
 * dependency. When `OTEL_ENABLED=true` and `@opentelemetry/sdk-node` is
 * installed, we initialise tracing + auto-instrumentations and redact
 * sensitive headers. When the env flag is false (default) OR the SDK
 * isn't installed, we no-op.
 *
 * Why not eager-import? `@opentelemetry/sdk-node` pulls in ~30 MB of
 * transitive deps. Round-18 ships the wiring + env contract; the operator
 * runs `npm i @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
 * @opentelemetry/exporter-trace-otlp-proto` when they're ready to enable.
 *
 * Round-18 acceptance:
 *   - boots cleanly with OTEL_ENABLED=false (the default in jest)
 *   - env validation refuses production boot when OTEL_ENABLED=true and
 *     OTEL_EXPORTER_OTLP_ENDPOINT is missing (already enforced by
 *     env.validation.ts)
 *   - never crashes the API process — any init failure becomes a warn log
 *   - redacts authorization, cookie, set-cookie, x-api-key headers from
 *     trace span attributes
 */

const REDACTED_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

export async function maybeStartOtel(): Promise<void> {
  if (process.env.OTEL_ENABLED !== 'true' && process.env.OTEL_ENABLED !== '1') {
    return;
  }
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    // env.validation already fails this in production; in dev we just warn.
    // eslint-disable-next-line no-console
    console.warn('[otel] OTEL_ENABLED=true but OTEL_EXPORTER_OTLP_ENDPOINT empty — skipping');
    return;
  }
  // Round-18: dynamic require via Function so TypeScript never tries to
  // type-resolve `@opentelemetry/*`. The packages are runtime-optional —
  // operator runs `npm i @opentelemetry/sdk-node ...` to enable.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynRequire = new Function('m', 'return require(m)') as (m: string) => any;
  let sdkMod: any;
  let exporterMod: any;
  let autoInstrMod: any;
  try {
    sdkMod = dynRequire('@opentelemetry/sdk-node');
    exporterMod = dynRequire('@opentelemetry/exporter-trace-otlp-proto');
    autoInstrMod = dynRequire('@opentelemetry/auto-instrumentations-node');
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      '[otel] OpenTelemetry packages not installed — skipping. ' +
        'Run `npm i @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node ' +
        '@opentelemetry/exporter-trace-otlp-proto` to enable.',
    );
    return;
  }

  try {
    const sdk = new sdkMod.NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'lifeos-api',
      traceExporter: new exporterMod.OTLPTraceExporter({ url: endpoint }),
      instrumentations: [
        autoInstrMod.getNodeAutoInstrumentations({
          // Don't auto-trace fs (chatty + low-value).
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-http': {
            // Round-18 redaction: never let a header value land in span attrs.
            requestHook: (_span: unknown, request: unknown) => {
              try {
                const headers = (request as { headers?: Record<string, unknown> }).headers;
                if (headers) {
                  for (const h of REDACTED_HEADERS) {
                    if (headers[h] !== undefined) headers[h] = '[REDACTED]';
                  }
                }
              } catch {
                // Best-effort redact; never throw out of a hook.
              }
            },
          },
        }),
      ],
    });
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(
      `[otel] started service=${process.env.OTEL_SERVICE_NAME ?? 'lifeos-api'} env=${process.env.OTEL_ENVIRONMENT ?? 'development'}`,
    );
    // Graceful shutdown — let pending spans flush.
    process.on('SIGTERM', () => {
      sdk.shutdown().catch(() => undefined);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn(`[otel] init failed (continuing without tracing): ${msg}`);
  }
}

export const __test = { REDACTED_HEADERS };
