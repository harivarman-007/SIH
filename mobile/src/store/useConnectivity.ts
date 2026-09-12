/**
 * useConnectivity.ts
 * Zustand store for simulating offline/online state during demos.
 * When `simulateOffline` is true, sync operations will fail with a "no network" error
 * regardless of the real device network state.
 */

import { create } from "zustand";
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
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isInternetReachable);
  },
}));
