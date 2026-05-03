import { z } from 'zod';

/**
 * Three privacy tiers. The tier governs *where* AI inference runs and *what*
 * data leaves the device.
 *
 *   CLOUD   default. Capture → API → cloud LLM. Sensitive blobs (journal,
 *           mood, financial detail) E2EE; classifier sees ciphertext only.
 *   HYBRID  recommended. Sensitive features run on-device; rest via cloud.
 *           Journal / mood / health drill-down never leave device.
 *   LOCAL   privacy-first. Phi-3.5-mini quantized on-device, no sync. App
 *           must remain fully functional 7 days offline.
 */
export const PRIVACY_TIERS = ['CLOUD', 'HYBRID', 'LOCAL'] as const;
export const PrivacyTierSchema = z.enum(PRIVACY_TIERS);
export type PrivacyTier = z.infer<typeof PrivacyTierSchema>;

export const PRIVACY_TIER_META: Record<
  PrivacyTier,
  {
    labelVi: string;
    labelEn: string;
    descriptionVi: string;
    descriptionEn: string;
    /** Whether this tier allows cloud-routed AI calls. */
    cloudAi: boolean;
    /** Whether this tier requires the on-device LLM bundle to be present. */
    requiresOnDeviceLlm: boolean;
    /** Whether sensitive fields (journal/mood/finance detail) are E2EE before leaving device. */
    e2eeSensitive: boolean;
  }
> = {
  CLOUD: {
    labelVi: 'Đám mây',
    labelEn: 'Cloud',
    descriptionVi: 'Tốc độ nhanh nhất, tính năng đầy đủ. Nội dung nhạy cảm được mã hoá đầu-cuối.',
    descriptionEn: 'Fastest, full features. Sensitive content end-to-end encrypted in transit and at rest.',
    cloudAi: true,
    requiresOnDeviceLlm: false,
    e2eeSensitive: true,
  },
  HYBRID: {
    labelVi: 'Kết hợp',
    labelEn: 'Hybrid',
    descriptionVi: 'Nội dung nhạy cảm xử lý ngay trên máy; phần còn lại dùng đám mây.',
    descriptionEn: 'Sensitive content stays on-device; the rest uses the cloud.',
    cloudAi: true,
    requiresOnDeviceLlm: true,
    e2eeSensitive: true,
  },
  LOCAL: {
    labelVi: 'Chỉ trên máy',
    labelEn: 'Local-only',
    descriptionVi: 'Mọi thứ chạy trên máy. Không sync, không cloud. Cần tải mô hình ~2.3GB.',
    descriptionEn: 'Everything runs on-device. No sync, no cloud. Requires ~2.3GB model bundle.',
    cloudAi: false,
    requiresOnDeviceLlm: true,
    e2eeSensitive: true,
  },
};
