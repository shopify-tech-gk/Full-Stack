import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// RN persistence adapters. shared-client keeps its guest-cart / guest-wishlist / recently-viewed
// logic platform-agnostic (the web injects localStorage); here we inject AsyncStorage for guest
// data and expo-secure-store for sensitive tokens (used in Phase 2b auth).

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/blocked: guest persistence is best-effort (same as the web localStorage path).
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Phase 2b: the refresh token lives here (RN has no httpOnly cookie like the web's `ym_rt`). */
export const secure = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
