/**
 * Hardware-backed secret storage for tokens.
 * On Android this maps to Keystore-encrypted SharedPreferences via
 * react-native-keychain. We use one logical "service" name as the key namespace.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.lifeos.ai.auth';

export interface SecureTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export const secureStorage = {
  async saveTokens(t: SecureTokens): Promise<void> {
    await Keychain.setGenericPassword(SERVICE, JSON.stringify(t), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async loadTokens(): Promise<SecureTokens | null> {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    if (!result || !result.password) return null;
    try {
      return JSON.parse(result.password) as SecureTokens;
    } catch {
      return null;
    }
  },

  async clearTokens(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE });
  },
};
