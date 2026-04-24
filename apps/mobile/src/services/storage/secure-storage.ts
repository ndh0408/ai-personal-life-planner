import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Secure on native, AsyncStorage on web (SecureStore is unsupported there).
 * Tokens MUST go through this — non-sensitive cache uses AsyncStorage directly.
 */
const useSecure = Platform.OS !== 'web';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (useSecure) return SecureStore.getItemAsync(key);
    return AsyncStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (useSecure) return SecureStore.setItemAsync(key, value);
    await AsyncStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (useSecure) return SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  },
};
