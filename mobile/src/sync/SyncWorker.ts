/**
 * SyncWorker.ts
 * Core two-way delta sync logic:
 * 1. Flushes offline inspection event outbox (START / SUBMIT)
 * 2. Pushes pending observations to POST /sync/batch
 * 3. Pulls inbound delta updates from GET /sync/pull?since=<watermark>
 *    with a 30s debounce on reconnect-triggered pulls and atomic watermark commit.
 */

import { observationRepository } from "../db/ObservationRepository";
import { inspectionRepository } from "../db/InspectionRepository";
import { actionRepository } from "../db/ActionRepository";
import { getDatabase } from "../db/schema";
import {
  postSyncBatch,
  fetchSyncPull,
  postInspectionStart,
  postInspectionSubmit,
} from "../api/sync";

const BATCH_SIZE = 50;
const RECONNECT_DEBOUNCE_MS = 30_000; // 30s debounce per user design answer #4

let _lastPullTime = 0;

export interface SyncResult {
  attempted: number;
  succeeded: number;
  failed: number;
  outboxAttempted: number;
  outboxSucceeded: number;
  outboxFailed: number;
  deltaInspections: number;
  deltaActions: number;
  errors: { localId?: number; error: string }[];
}

/**
 * Flushes queued offline inspection events (START, SUBMIT).
 */
export async function flushInspectionOutbox(): Promise<{ attempted: number; succeeded: number; failed: number }> {
  const pending = await inspectionRepository.getPendingOutbox();
  let succeeded = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      if (item.event_type === "START") {
        await postInspectionStart(item.inspection_id);
      } else if (item.event_type === "SUBMIT") {
        let notes: string | undefined = undefined;
        try {
          const parsed = JSON.parse(item.payload_json);
          notes = parsed.notes;
        } catch {
          // ignore parse error
        }
        await postInspectionSubmit(item.inspection_id, notes);
      }
      await inspectionRepository.markOutboxItemSynced(item.id);
      succeeded++;
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.message || "Outbox sync failed";
      // Handle idempotency (e.g., if already in progress or already submitted)
      if (err?.response?.status === 400 && (msg.includes("already") || msg.includes("Cannot transition"))) {
        await inspectionRepository.markOutboxItemSynced(item.id);
        succeeded++;
      } else {
        await inspectionRepository.markOutboxItemError(item.id, msg);
        failed++;
      }
    }
  }

  return { attempted: pending.length, succeeded, failed };
}

/**
 * Pulls two-way delta sync from server and updates local SQLite tables.
 * Advances watermark ONLY after the entire delta is applied.
 */
export async function pullDeltaSync(force: boolean = false): Promise<{ inspections: number; actions: number; watermark: string | null }> {
  const now = Date.now();
  if (!force && now - _lastPullTime < RECONNECT_DEBOUNCE_MS) {
    return { inspections: 0, actions: 0, watermark: null };
  }

  const db = await getDatabase();

  // 1. Read current watermark
  const metaRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'watermark';"
  );
  const currentWatermark = metaRow?.value || null;

  // 2. Fetch delta from server
  const response = await fetchSyncPull(currentWatermark);

  // 3. Atomically apply all delta items, then advance watermark
  await db.withTransactionAsync(async () => {
    // A. Apply cached inspections
    if (response.inspections && response.inspections.length > 0) {
      await inspectionRepository.saveBatch(response.inspections);
    }

    // B. Apply cached actions
    if (response.actions && response.actions.length > 0) {
      await actionRepository.saveBatch(response.actions);
    }

    // C. Update local observations statuses if server updated them
    if (response.observations && response.observations.length > 0) {
      for (const obs of response.observations) {
        await db.runAsync(
          `UPDATE local_observations
           SET sync_status = 'synced'
           WHERE server_uuid = ?;`,
          [obs.id]
        );
      }
    }

    // D. Only advance watermark after entire batch is committed (rule #4)
    if (response.watermark) {
      await db.runAsync(
        `INSERT INTO sync_meta (key, value)
         VALUES ('watermark', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        [response.watermark]
      );
    }
  });

  _lastPullTime = Date.now();

  return {
    inspections: response.inspections?.length || 0,
    actions: response.actions?.length || 0,
    watermark: response.watermark,
  };
}

/**
 * Syncs all pending observations in batches.
 */
export async function syncPending(): Promise<{ attempted: number; succeeded: number; failed: number; errors: any[] }> {
  const result = { attempted: 0, succeeded: 0, failed: 0, errors: [] as any[] };

  try {
    await observationRepository.resetAllErrorsToPending();
  } catch {
    // Non-fatal
  }

  const pending = await observationRepository.getPending(BATCH_SIZE);
  if (pending.length === 0) return result;

  result.attempted = pending.length;

  try {
    const batchResponse = await postSyncBatch(pending);
    const createdIds = batchResponse.created_ids ?? [];
    for (let i = 0; i < pending.length; i++) {
      const localId = pending[i].local_id;
      const serverUuid = createdIds[i] ?? `unknown-${localId}`;
      await observationRepository.markSynced(localId, serverUuid);
      result.succeeded++;
    }
  } catch (err: unknown) {
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
 * Full two-way sync:
 * 1. Flushes offline inspection outbox
 * 2. Pushes pending observations
 * 3. Pulls inbound delta updates from server
 */
export async function syncAll(forcePull: boolean = true): Promise<SyncResult> {
  // 1. Flush inspection outbox
  const outboxRes = await flushInspectionOutbox();

  // 2. Push observations
  const obsRes = await syncPending();

  // 3. Pull delta updates
  let pullRes = { inspections: 0, actions: 0, watermark: null as string | null };
  try {
    pullRes = await pullDeltaSync(forcePull);
  } catch {
    // Non-fatal if pull encounters transient failure
  }

  return {
    attempted: obsRes.attempted,
    succeeded: obsRes.succeeded,
    failed: obsRes.failed,
    outboxAttempted: outboxRes.attempted,
    outboxSucceeded: outboxRes.succeeded,
    outboxFailed: outboxRes.failed,
    deltaInspections: pullRes.inspections,
    deltaActions: pullRes.actions,
    errors: obsRes.errors,
  };
}

/**
 * Returns current sync statistics as a percentage.
 */
export async function getSyncStats(): Promise<{
  total: number;
  synced: number;
  pending: number;
  outboxPending: number;
  error: number;
  syncPct: number;
}> {
  const stats = await observationRepository.getSyncStats();
  const outboxPending = await inspectionRepository.getPendingOutboxCount();
  const totalItems = stats.total + outboxPending;
  const pendingTotal = stats.pending + outboxPending;
  const syncPct = totalItems > 0 ? Math.round(((totalItems - pendingTotal) / totalItems) * 100) : 100;

  return {
    ...stats,
    pending: pendingTotal,
    outboxPending,
    syncPct,
  };
}
