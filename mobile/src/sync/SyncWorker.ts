/**
 * SyncWorker.ts
 * Core sync logic: fetches pending observations from SQLite and POSTs them to the backend.
 * Used by both the background task and the manual "Sync Now" button.
 */

import { observationRepository } from "../db/ObservationRepository";
import { postSyncBatch } from "../api/sync";

const BATCH_SIZE = 50;

export interface SyncResult {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: { localId: number; error: string }[];
}

/**
 * Syncs all pending observations in batches.
 * Returns a summary of what was attempted, succeeded, and failed.
 */
export async function syncPending(): Promise<SyncResult> {
  const result: SyncResult = { attempted: 0, succeeded: 0, failed: 0, errors: [] };

  const pending = await observationRepository.getPending(BATCH_SIZE);
  if (pending.length === 0) return result;

  result.attempted = pending.length;

  // Group into a single batch for efficiency
  try {
    const batchResponse = await postSyncBatch(pending);

    // Match created_ids back to local_ids by position
    const createdIds = batchResponse.created_ids ?? [];
    for (let i = 0; i < pending.length; i++) {
      const localId = pending[i].local_id;
      const serverUuid = createdIds[i] ?? `unknown-${localId}`;
      await observationRepository.markSynced(localId, serverUuid);
      result.succeeded++;
    }
  } catch (err: unknown) {
    // Entire batch failed — mark all as error for retry
    const errorMessage = err instanceof Error ? err.message : "Network error during sync";
    for (const obs of pending) {
      await observationRepository.markError(obs.local_id, errorMessage);
      result.failed++;
      result.errors.push({ localId: obs.local_id, error: errorMessage });
    }
  }

  return result;
}

/**
 * Returns current sync statistics as a percentage.
 */
export async function getSyncStats(): Promise<{
  total: number;
  synced: number;
  pending: number;
  error: number;
  syncPct: number;
}> {
  const stats = await observationRepository.getSyncStats();
  const syncPct = stats.total > 0 ? Math.round((stats.synced / stats.total) * 100) : 100;
  return { ...stats, syncPct };
}
