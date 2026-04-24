import { STORAGE_KEYS } from '../../constants';
import { secureStorage } from '../storage/secure-storage';

export const tokenStore = {
  getAccess: () => secureStorage.get(STORAGE_KEYS.ACCESS_TOKEN),
  getRefresh: () => secureStorage.get(STORAGE_KEYS.REFRESH_TOKEN),
  async set(access: string, refresh: string) {
    await secureStorage.set(STORAGE_KEYS.ACCESS_TOKEN, access);
    await secureStorage.set(STORAGE_KEYS.REFRESH_TOKEN, refresh);
  },
  async clear() {
    await secureStorage.remove(STORAGE_KEYS.ACCESS_TOKEN);
    await secureStorage.remove(STORAGE_KEYS.REFRESH_TOKEN);
  },
};
