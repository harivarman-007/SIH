/**
 * TaskManager.ts
 * Registers expo-background-fetch + expo-task-manager background sync task.
 * Also exports triggerManualSync() for the "Sync Now" UI button.
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Network from "expo-network";
import { syncPending, SyncResult } from "./SyncWorker";
import { useConnectivityStore } from "../store/useConnectivity";

export const SYNC_TASK_NAME = "INTELLIFUSION_SYNC_TASK";

// Define the background task
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isInternetReachable) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const result = await syncPending();
    return result.succeeded > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registers the background sync task. Call once on app startup.
 */
export async function registerBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
      minimumInterval: 30, // 30 seconds minimum (actual timing is OS-controlled)
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
    // Task may already be registered — safe to ignore
    console.warn("Background sync registration:", err);
  }
}

/**
 * Unregisters the background sync task.
 */
export async function unregisterBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(SYNC_TASK_NAME);
  }
}

/**
 * Manually triggers a sync. Used by the "Sync Now" button.
 * Returns sync result for UI feedback.
 */
export async function triggerManualSync(): Promise<SyncResult> {
  const online = await isOnline();
  if (!online) {
    throw new Error("No internet connection. Please check your network and try again.");
  }
  return syncPending();
}

/**
 * Checks if device currently has internet connectivity.
 * Respects the demo offline simulation toggle.
 */
export async function isOnline(): Promise<boolean> {
  const { simulateOffline } = useConnectivityStore.getState();
  if (simulateOffline) return false;
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isInternetReachable);
}
