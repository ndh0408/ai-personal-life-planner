import { apiClient } from './client';
import type { DeviceDataSyncRequest, DeviceDataSyncResponse } from '@lifeos/shared';

export const deviceDataService = {
  sync(input: DeviceDataSyncRequest) {
    return apiClient.request<DeviceDataSyncResponse>('POST', '/device-data/sync', input);
  },
  recent() {
    return apiClient.request<{
      sleep: Array<{
        id: string;
        sleepAt: string;
        wakeAt: string;
        durationMinutes: number;
        quality: 'BAD' | 'OK' | 'GOOD' | null;
        source: 'MANUAL' | 'DEVICE' | 'INFERRED';
      }>;
      hr: Array<{ bucketStart: string; avgBpm: number; maxBpm: number }>;
      steps: Array<{ bucketStart: string; steps: number }>;
    }>('GET', '/device-data/recent');
  },
  inferSleep() {
    return apiClient.request<{ sleepLogId: string | null; inferred: boolean }>(
      'POST',
      '/device-data/infer-sleep',
      {},
    );
  },
};
