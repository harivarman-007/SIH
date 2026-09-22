/**
 * InspectionRepository.ts
 * Data access layer for cached statutory inspections and inspection event outbox.
 */

import { getDatabase, CachedInspection, InspectionOutboxItem } from "./schema";

export const inspectionRepository = {
  async getAll(): Promise<CachedInspection[]> {
    const db = await getDatabase();
    return db.getAllAsync<CachedInspection>(
      "SELECT * FROM cached_inspections ORDER BY scheduled_for DESC;"
    );
  },

  async getById(id: string): Promise<CachedInspection | null> {
    const db = await getDatabase();
    return db.getFirstAsync<CachedInspection>(
      "SELECT * FROM cached_inspections WHERE id = ?;",
      [id]
    );
  },

  async saveBatch(inspections: any[]): Promise<void> {
    if (!inspections || inspections.length === 0) return;
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      for (const item of inspections) {
        await db.runAsync(
          `INSERT INTO cached_inspections (
            id, code, mine_site_id, zone_id, title, assigned_inspector_id,
            scheduled_for, due_at, status, started_at, completed_at, submitted_at,
            notes, observation_count, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            status = excluded.status,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            submitted_at = excluded.submitted_at,
            notes = excluded.notes,
            observation_count = excluded.observation_count,
            updated_at = excluded.updated_at;`,
          [
            item.id,
            item.code,
            item.mine_site_id,
            item.zone_id || null,
            item.title,
            item.assigned_inspector_id,
            item.scheduled_for,
            item.due_at,
            item.status,
            item.started_at || null,
            item.completed_at || null,
            item.submitted_at || null,
            item.notes || null,
            item.observation_count || 0,
            item.updated_at || new Date().toISOString(),
          ]
        );
      }
    });
  },

  async startInspectionLocal(inspectionId: string): Promise<void> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // 1. Optimistically update local cached inspection
      await db.runAsync(
        `UPDATE cached_inspections
         SET status = 'in_progress', started_at = ?, updated_at = ?
         WHERE id = ?;`,
        [nowIso, nowIso, inspectionId]
      );

      // 2. Queue in outbox
      await db.runAsync(
        `INSERT INTO inspection_outbox (inspection_id, event_type, payload_json, status, created_at)
         VALUES (?, 'START', ?, 'pending', ?);`,
        [inspectionId, JSON.stringify({ started_at: nowIso }), nowIso]
      );
    });
  },

  async submitInspectionLocal(inspectionId: string, notes?: string): Promise<void> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // 1. Optimistically update local cached inspection
      await db.runAsync(
        `UPDATE cached_inspections
         SET status = 'submitted', submitted_at = ?, notes = coalesce(notes || '\n', '') || ?, updated_at = ?
         WHERE id = ?;`,
        [nowIso, notes ? `[Offline Submit Note]: ${notes}` : "", nowIso, inspectionId]
      );

      // 2. Queue in outbox
      await db.runAsync(
        `INSERT INTO inspection_outbox (inspection_id, event_type, payload_json, status, created_at)
         VALUES (?, 'SUBMIT', ?, 'pending', ?);`,
        [inspectionId, JSON.stringify({ notes: notes || "" }), nowIso]
      );
    });
  },

  async getPendingOutbox(): Promise<InspectionOutboxItem[]> {
    const db = await getDatabase();
    return db.getAllAsync<InspectionOutboxItem>(
      "SELECT * FROM inspection_outbox WHERE status = 'pending' ORDER BY id ASC;"
    );
  },

  async markOutboxItemSynced(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE inspection_outbox SET status = 'synced' WHERE id = ?;",
      [id]
    );
  },

  async markOutboxItemError(id: number, error: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE inspection_outbox
       SET status = 'error', retry_count = retry_count + 1, last_error = ?
       WHERE id = ?;`,
      [error, id]
    );
  },

  async getActiveCount(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM cached_inspections
       WHERE status IN ('scheduled', 'in_progress');`
    );
    return row?.count || 0;
  },

  async getPendingOutboxCount(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM inspection_outbox WHERE status = 'pending';`
    );
    return row?.count || 0;
  },
};
