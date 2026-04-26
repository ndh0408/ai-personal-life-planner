import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'lifeos.tokens.access';
const REFRESH_KEY = 'lifeos.tokens.refresh';
const ACCESS_EXP_KEY = 'lifeos.tokens.accessExp';
const REFRESH_EXP_KEY = 'lifeos.tokens.refreshExp';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export const tokenStorage = {
  async load(): Promise<StoredTokens | null> {
    const [a, r, ae, re] = await Promise.all([
      AsyncStorage.getItem(ACCESS_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
      AsyncStorage.getItem(ACCESS_EXP_KEY),
      AsyncStorage.getItem(REFRESH_EXP_KEY),
    ]);
    if (!a || !r || !ae || !re) return null;
    return {
      accessToken: a,
      refreshToken: r,
      accessTokenExpiresAt: ae,
      refreshTokenExpiresAt: re,
    };
  },

  async save(t: StoredTokens): Promise<void> {
    await AsyncStorage.multiSet([
      [ACCESS_KEY, t.accessToken],
      [REFRESH_KEY, t.refreshToken],
      [ACCESS_EXP_KEY, t.accessTokenExpiresAt],
      [REFRESH_EXP_KEY, t.refreshTokenExpiresAt],
    ]);
  },

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, ACCESS_EXP_KEY, REFRESH_EXP_KEY]);
  },
};
