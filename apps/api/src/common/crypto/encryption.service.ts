import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const FORMAT_TAG = 'v1:gcm';

/**
 * Stores a single packed string in the DB:
 *   "v1:gcm:<iv_b64>:<tag_b64>:<ct_b64>"
 * The version tag lets us migrate to a new algorithm later without ambiguity.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('USER_AI_KEY_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error(
        'USER_AI_KEY_ENCRYPTION_KEY is not set. Generate with: openssl rand -hex 32',
      );
    }
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error('USER_AI_KEY_ENCRYPTION_KEY must be 64 hex chars (32 bytes).');
    }
    this.key = Buffer.from(raw, 'hex');
    if (this.key.length !== KEY_BYTES) {
      throw new Error(`USER_AI_KEY_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes.`);
    }
  }

  seal(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [FORMAT_TAG, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(
      ':',
    );
  }

  open(packed: string): string {
    const parts = packed.split(':');
    if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== FORMAT_TAG) {
      throw new Error('encrypted payload format is unrecognised');
    }
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const ct = Buffer.from(parts[4], 'base64');
    if (iv.length !== IV_BYTES) {
      throw new Error(`encrypted payload IV must be ${IV_BYTES} bytes`);
    }
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  }

  /**
   * "sk-1234567890abcdef...XYZ" → { last4: "9XYZ", masked: "sk-•••••••••9XYZ" }
   * Useful for UserAiKey display fields (apiKeyLast4, maskedApiKey).
   */
  static fingerprint(plaintextKey: string): { last4: string; masked: string } {
    const last4 = plaintextKey.slice(-4);
    return {
      last4,
      masked: `sk-${'•'.repeat(9)}${last4}`,
    };
  }
}
