import { z } from 'zod';

/**
 * Device-data sync contract (round 36).
 *
 * Mobile pushes batches of sensor samples to /device-data/sync. The API
 * is conservative:
 *   - Each batch is per-source (Health Connect / HealthKit / inferred).
 *   - Each sample carries its own timestamp + a stable platform id so
 *     retries dedupe deterministically.
 *   - The API replies with the new lastSyncedAt watermark; the next
 *     batch from the phone uses it as the lower bound.
 *
 * Privacy: when `useHealthForAI=false` is set, the endpoint accepts the
 * payload (so the user can still inspect their history) but the rows
 * are flagged in EventLog and never enter the assistant snapshot —
 * UserContextService already gates on the same flag.
 */

export const DeviceSourceSchema = z.enum(['health-connect', 'healthkit', 'inferred']);
export type DeviceSource = z.infer<typeof DeviceSourceSchema>;

export const SleepSampleSchema = z.object({
  /** Stable per-platform id (HealthKit UUID / Health Connect record id). */
  recordId: z.string().min(1).max(120),
  sleepAt: z.string().datetime(),
  wakeAt: z.string().datetime(),
  /** Optional override; API recomputes from sleepAt/wakeAt if omitted. */
  durationMinutes: z.number().int().min(15).max(20 * 60).optional(),
  /** Health Connect maps stages to a coarse quality. */
  quality: z.enum(['BAD', 'OK', 'GOOD']).nullable().optional(),
});
export type SleepSample = z.infer<typeof SleepSampleSchema>;

export const HeartRateSampleSchema = z.object({
  bucketStart: z.string().datetime(),
  avgBpm: z.number().int().min(20).max(240),
  maxBpm: z.number().int().min(20).max(240),
  recordId: z.string().min(1).max(120).optional(),
});
export type HeartRateSampleDto = z.infer<typeof HeartRateSampleSchema>;

export const StepBucketSchema = z.object({
  bucketStart: z.string().datetime(),
  steps: z.number().int().nonnegative().max(60_000),
});
export type StepBucket = z.infer<typeof StepBucketSchema>;

export const DeviceDataSyncRequestSchema = z.object({
  source: DeviceSourceSchema,
  /** Optional device meta: { manufacturer, model, osVersion, appVersion }. */
  deviceMeta: z.record(z.string(), z.string()).optional(),
  sleep: z.array(SleepSampleSchema).max(200).optional(),
  heartRate: z.array(HeartRateSampleSchema).max(2000).optional(),
  steps: z.array(StepBucketSchema).max(2000).optional(),
});
export type DeviceDataSyncRequest = z.infer<typeof DeviceDataSyncRequestSchema>;

export const DeviceDataSyncResponseSchema = z.object({
  source: DeviceSourceSchema,
  /** ISO timestamp; phone uses this as the next batch's lower bound. */
  lastSyncedAt: z.string().datetime(),
  /** Counts the API actually persisted (idempotent dedupe drops repeats). */
  inserted: z.object({
    sleep: z.number().int().nonnegative(),
    heartRate: z.number().int().nonnegative(),
    steps: z.number().int().nonnegative(),
  }),
  /** True iff useHealthForAI is currently false. UI can warn but still sync. */
  privacyHidden: z.boolean(),
});
export type DeviceDataSyncResponse = z.infer<typeof DeviceDataSyncResponseSchema>;
