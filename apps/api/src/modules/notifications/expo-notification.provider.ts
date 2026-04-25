import { Injectable, Logger } from '@nestjs/common';

export type PushPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type DeliveryResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'INVALID_TOKEN' | 'PROVIDER_ERROR' | 'RATE_LIMITED'; error?: string };

/**
 * Defines the contract for any push provider — Expo today, APNs/FCM tomorrow.
 * Worker depends only on this interface so we can swap providers without
 * touching the queue/worker layer.
 */
export interface NotificationDeliveryProvider {
  send(payload: PushPayload): Promise<DeliveryResult>;
}

/**
 * Default provider — POSTs to Expo Push API. When no Expo access token is
 * configured (local/dev/test) the provider behaves as a no-op success so the
 * worker pipeline is exercised without making outbound network calls.
 */
@Injectable()
export class ExpoNotificationProvider implements NotificationDeliveryProvider {
  private readonly logger = new Logger(ExpoNotificationProvider.name);
  private readonly url = 'https://exp.host/--/api/v2/push/send';

  async send(payload: PushPayload): Promise<DeliveryResult> {
    if (process.env.NODE_ENV === 'test' || process.env.EXPO_PUSH_DRY_RUN === 'true') {
      // Dry-run: log only metadata (never user payload) and return success.
      this.logger.debug(`expo-push dry-run to=${payload.to.slice(0, 8)}…`);
      return { ok: true, id: `dry-run-${Date.now()}` };
    }
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          to: payload.to,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          sound: 'default',
          priority: 'high',
        }),
      });
      if (res.status === 429) return { ok: false, reason: 'RATE_LIMITED' };
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, reason: 'PROVIDER_ERROR', error: `${res.status} ${text.slice(0, 200)}` };
      }
      const json = (await res.json()) as { data?: { id?: string; status?: string; details?: { error?: string } } };
      const status = json?.data?.status;
      const errCode = json?.data?.details?.error;
      if (status === 'error' && (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials')) {
        return { ok: false, reason: 'INVALID_TOKEN', error: errCode };
      }
      return { ok: true, id: json?.data?.id ?? '' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, reason: 'PROVIDER_ERROR', error: msg };
    }
  }
}

export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');
