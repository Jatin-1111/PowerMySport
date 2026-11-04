import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};

// The session token lives in the OS keystore on a device. expo-secure-store has no web
// implementation, so the browser preview used for development falls back to AsyncStorage.
const hasKeystore = Platform.OS !== "web";

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return hasKeystore ? await SecureStore.getItemAsync(key) : await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (hasKeystore) await SecureStore.setItemAsync(key, value);
    else await AsyncStorage.setItem(key, value);
  },

  async remove(key: string): Promise<void> {
    try {
      if (hasKeystore) await SecureStore.deleteItemAsync(key);
      else await AsyncStorage.removeItem(key);
    } catch {
      // nothing stored under this key
    }
  },
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: "pms_auth_token",
  USER: "pms_user",
} as const;
