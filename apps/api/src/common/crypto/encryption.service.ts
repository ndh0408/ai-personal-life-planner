import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * Symmetric encryption for at-rest secrets (e.g. user-supplied AI API keys).
 *
 * Algorithm: AES-256-GCM. Wire format: `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>`.
 * The `v1:` prefix lets us rotate the algorithm or key derivation later
 * without ambiguity at decrypt time.
 *
 * The encryption key comes from the `AI_PROVIDER_ENCRYPTION_KEY` env var.
 * Accepted forms:
 *   - 64-char hex  → decoded to 32 raw bytes
 *   - 32+ char ASCII → SHA-256 hashed into 32 bytes (still high-entropy if
 *     you provide a long passphrase; recommended only for development).
 *
 * In production we fail fast in the constructor if the var is missing or
 * too short, so the app refuses to start with a degraded crypto config.
 *
 * NEVER log decrypted plaintext. Decrypt only at the moment of use.
 */
@Injectable()
export class EncryptionService {
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly IV_BYTES = 12; // GCM-recommended
  private static readonly TAG_BYTES = 16;
  private static readonly VERSION = 'v1';

  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = (config.get<string>('AI_PROVIDER_ENCRYPTION_KEY') ?? '').trim();
    const isProd = config.get<string>('NODE_ENV') === 'production';

    if (!raw) {
      const msg = 'AI_PROVIDER_ENCRYPTION_KEY is not set.';
      if (isProd) throw new Error(msg);
      this.logger.warn(`${msg} Using ephemeral dev key — secrets WILL NOT survive restart.`);
      this.key = randomBytes(32);
      return;
    }

    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      this.key = Buffer.from(raw, 'hex');
      return;
    }

    if (raw.length < 32) {
      const msg =
        'AI_PROVIDER_ENCRYPTION_KEY is too short — provide 64 hex chars (recommended) or a 32+ char passphrase.';
      if (isProd) throw new Error(msg);
      this.logger.warn(msg);
    }

    // Passphrase fallback — derive a 32-byte key via SHA-256.
    this.key = createHash('sha256').update(raw, 'utf8').digest();
  }

  /**
   * Encrypt a plaintext secret. Returns a self-contained, base64-packed string
   * safe to store in a TEXT column.
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(EncryptionService.IV_BYTES);
    const cipher = createCipheriv(EncryptionService.ALGO, this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      EncryptionService.VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      ct.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt a ciphertext produced by {@link encrypt}. Throws on tampering or
   * key mismatch — callers should treat the error as a hard failure (do not
   * silently fall back; data may be compromised or the key was rotated
   * incorrectly).
   */
  decrypt(packed: string): string {
    const parts = packed.split(':');
    if (parts.length !== 4 || parts[0] !== EncryptionService.VERSION) {
      throw new Error('Invalid ciphertext format');
    }
    const [, ivB64, tagB64, ctB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    if (iv.length !== EncryptionService.IV_BYTES || tag.length !== EncryptionService.TAG_BYTES) {
      throw new Error('Invalid ciphertext components');
    }
    const decipher = createDecipheriv(EncryptionService.ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString('utf8');
  }

  /**
   * Last 4 chars of an API key, kept plaintext for masked UI display.
   * Returned even for very short inputs so the UI never shows "undefined".
   */
  static last4(apiKey: string): string {
    const trimmed = apiKey.trim();
    if (trimmed.length <= 4) return trimmed;
    return trimmed.slice(-4);
  }

  /**
   * UI-friendly mask: keeps the well-known prefix (sk-, nvapi-, etc.) and the
   * last 4 chars of the secret. Examples:
   *   sk-abc...xyz12   → "sk-****xyz12"... actually we want last 4 only:
   *   sk-1234567890abcd → "sk-****90abcd"... we expose last 4: "sk-****90ab"
   *
   * Deterministic and never reveals the key body.
   */
  static mask(apiKey: string): string {
    const trimmed = apiKey.trim();
    const last4 = EncryptionService.last4(trimmed);
    const prefixMatch = trimmed.match(/^([A-Za-z]+-)/);
    const prefix = prefixMatch?.[1] ?? '';
    return `${prefix}****${last4}`;
  }
}
