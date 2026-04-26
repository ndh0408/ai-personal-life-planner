import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard
const KEY_BYTES = 32;

export interface SealedSecret {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

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

  seal(plaintext: string): SealedSecret {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: ct.toString('base64'),
      iv: iv.toString('base64'),
      authTag: tag.toString('base64'),
    };
  }

  open(sealed: SealedSecret): string {
    const iv = Buffer.from(sealed.iv, 'base64');
    const tag = Buffer.from(sealed.authTag, 'base64');
    const ct = Buffer.from(sealed.ciphertext, 'base64');
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  }
}
