/**
 * Ingest sensor batches from the mobile app (round 36).
 *
 * The phone collects samples (Health Connect on Android, HealthKit on iOS,
 * or app-inactivity inference) and POSTs them here. We:
 *
 *   1. Look up the per-source sync cursor — anything older is dropped on
 *      the floor (the phone shouldn't send those, but a buggy retry could).
 *   2. Upsert each sample by (userId, recordId) for sleep, or
 *      (userId, bucketStart) for HR / steps. Idempotent retries are a
 *      no-op rather than a duplicate row.
 *   3. Bump the cursor to the newest sample we accepted.
 *   4. Log a single DEVICE_DATA_SYNCED event with summary counts so the
 *      assistant can mention it ("Tracked 3 nights of sleep this week").
 *
 * Privacy: rows are persisted regardless of `useHealthForAI` (so the
 * user can audit their own history) — but `UserContextService` already
 * gates them out of the AI snapshot when the flag is off, and the
 * response carries `privacyHidden=true` so the UI can warn.
 *
 * The persistence path uses `prisma.$transaction` so a partial failure
 * doesn't leave the cursor ahead of the data.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DeviceDataSyncRequest, DeviceDataSyncResponse } from '@lifeos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../intelligence/event-log.service';
import { UserContextService } from '../intelligence/user-context.service';

@Injectable()
export class DeviceDataService {
  private readonly logger = new Logger(DeviceDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventLogService,
    private readonly userCtx: UserContextService,
  ) {}

  async sync(userId: string, body: DeviceDataSyncRequest): Promise<DeviceDataSyncResponse> {
    const privacy = await this.prisma.privacySetting.findUnique({ where: { userId } });
    const privacyHidden = privacy ? !privacy.useHealthForAI : false;

    const cursorRow = await this.prisma.deviceSyncCursor.findUnique({
      where: { userId_source: { userId, source: body.source } },
    });
    const watermark = cursorRow?.lastSyncedAt ?? new Date(0);

    const sleepRows = (body.sleep ?? []).filter((s) => new Date(s.sleepAt) > watermark);
    const hrRows = (body.heartRate ?? []).filter((h) => new Date(h.bucketStart) > watermark);
    const stepRows = (body.steps ?? []).filter((s) => new Date(s.bucketStart) > watermark);

    const dataSource: 'DEVICE' | 'INFERRED' = body.source === 'inferred' ? 'INFERRED' : 'DEVICE';

    let insertedSleep = 0;
    let insertedHr = 0;
    let insertedSteps = 0;
    let newestSeen = watermark;

    await this.prisma.$transaction(async (tx) => {
      // Sleep — upsert by (userId, deviceRecordId). The model has no
      // unique index on that pair (Health Connect ids aren't globally
      // unique across users), so we emulate upsert with findFirst.
      for (const s of sleepRows) {
        const existing = await tx.sleepLog.findFirst({
          where: { userId, deviceRecordId: s.recordId },
        });
        const sleepAt = new Date(s.sleepAt);
        const wakeAt = new Date(s.wakeAt);
        const duration =
          s.durationMinutes ?? Math.max(15, Math.round((wakeAt.getTime() - sleepAt.getTime()) / 60_000));
        if (existing) {
          await tx.sleepLog.update({
            where: { id: existing.id },
            data: {
              sleepAt,
              wakeAt,
              durationMinutes: duration,
              quality: s.quality ?? null,
              source: dataSource,
            },
          });
        } else {
          await tx.sleepLog.create({
            data: {
              userId,
              sleepAt,
              wakeAt,
              durationMinutes: duration,
              quality: s.quality ?? null,
              source: dataSource,
              deviceRecordId: s.recordId,
            },
          });
          insertedSleep++;
        }
        if (sleepAt > newestSeen) newestSeen = sleepAt;
      }

      // HR — bucketStart unique per user.
      for (const h of hrRows) {
        const bucket = new Date(h.bucketStart);
        await tx.heartRateSample.upsert({
          where: { userId_bucketStart: { userId, bucketStart: bucket } },
          update: {
            avgBpm: h.avgBpm,
            maxBpm: h.maxBpm,
            source: dataSource,
            deviceRecordId: h.recordId ?? null,
          },
          create: {
            userId,
            bucketStart: bucket,
            avgBpm: h.avgBpm,
            maxBpm: h.maxBpm,
            source: dataSource,
            deviceRecordId: h.recordId ?? null,
          },
        });
        insertedHr++;
        if (bucket > newestSeen) newestSeen = bucket;
      }

      // Steps — bucketStart unique per user.
      for (const st of stepRows) {
        const bucket = new Date(st.bucketStart);
        await tx.activitySample.upsert({
          where: { userId_bucketStart: { userId, bucketStart: bucket } },
          update: { steps: st.steps, source: dataSource },
          create: {
            userId,
            bucketStart: bucket,
            steps: st.steps,
            appMinutes: 0,
            source: dataSource,
          },
        });
        insertedSteps++;
        if (bucket > newestSeen) newestSeen = bucket;
      }

      if (newestSeen > watermark) {
        await tx.deviceSyncCursor.upsert({
          where: { userId_source: { userId, source: body.source } },
          update: {
            lastSyncedAt: newestSeen,
            meta: (body.deviceMeta ?? {}) as Prisma.InputJsonValue,
          },
          create: {
            userId,
            source: body.source,
            lastSyncedAt: newestSeen,
            meta: (body.deviceMeta ?? {}) as Prisma.InputJsonValue,
          },
        });
      }
    });

    if (insertedSleep + insertedHr + insertedSteps > 0) {
      await this.events
        .log(userId, 'DEVICE_DATA_SYNCED', `synced from ${body.source}`, {
          source: body.source,
          insertedSleep,
          insertedHr,
          insertedSteps,
        })
        .catch(() => undefined);
      // Drop snapshot cache so the next AI call sees the new device data.
      await this.userCtx.invalidate(userId).catch(() => undefined);
    }

    return {
      source: body.source,
      lastSyncedAt: newestSeen.toISOString(),
      inserted: {
        sleep: insertedSleep,
        heartRate: insertedHr,
        steps: insertedSteps,
      },
      privacyHidden,
    };
  }

  /**
   * Read endpoint — returns the most recent samples per kind. Used by
   * the mobile DevPanel to verify data flowed through, and by the
   * adaptive-home reorder logic on the server side.
   */
  async getRecent(userId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const [sleep, hr, steps] = await Promise.all([
      this.prisma.sleepLog.findMany({
        where: { userId, sleepAt: { gte: since } },
        orderBy: { sleepAt: 'desc' },
        take: 14,
        select: {
          id: true,
          sleepAt: true,
          wakeAt: true,
          durationMinutes: true,
          quality: true,
          source: true,
        },
      }),
      this.prisma.heartRateSample.findMany({
        where: { userId, bucketStart: { gte: since } },
        orderBy: { bucketStart: 'desc' },
        take: 96,
      }),
      this.prisma.activitySample.findMany({
        where: { userId, bucketStart: { gte: since } },
        orderBy: { bucketStart: 'desc' },
        take: 96,
      }),
    ]);
    return { sleep, hr, steps };
  }
}
