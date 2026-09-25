/**
 * storage.ts
 * Cross-platform persistence layer for Intellifusion Mobile:
 * - Native: expo-secure-store
 * - Web: window.localStorage
 * - Memory fallback: in-memory map
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const _memoryStore = new Map<string, string>();

export const appStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") {
          return localStorage.getItem(key);
        }
      } catch {
        // Fallback to memory
      }
      return _memoryStore.get(key) ?? null;
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return _memoryStore.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    _memoryStore.set(key, value);

    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(key, value);
        }
      } catch {
        // Ignore
      }
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Ignore
    }
  },

  async deleteItem(key: string): Promise<void> {
    _memoryStore.delete(key);

    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(key);
        }
      } catch {
        // Ignore
      }
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore
    }
  },
};
