/**
 * useConnectivity.ts
 * Zustand store for simulating offline/online state during demos.
 * Supports Web and Native LAN networks properly.
 */

import { create } from "zustand";
import { Platform } from "react-native";
import * as Network from "expo-network";

interface ConnectivityState {
  simulateOffline: boolean;
  toggleSimulateOffline: () => void;
  getIsOnline: () => Promise<boolean>;
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  simulateOffline: false,

  toggleSimulateOffline: () =>
    set((state) => ({ simulateOffline: !state.simulateOffline })),

  getIsOnline: async () => {
    if (get().simulateOffline) return false;
    if (Platform.OS === "web") {
      return typeof navigator !== "undefined" ? navigator.onLine : true;
    }
    try {
      const state = await Network.getNetworkStateAsync();
      return Boolean(state.isConnected && state.isInternetReachable !== false);
    } catch {
      return true;
    }
  },
}));
