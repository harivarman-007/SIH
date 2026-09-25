/**
 * ObservationRepository.ts
 * CRUD operations for local_observations table.
 */

import { getDatabase, LocalObservation, ObservationCategory, RiskFlag } from "./schema";

export interface NewObservationInput {
  category: ObservationCategory;
  description: string;
  photo_uri?: string | null;
  gas_reading_value?: number | null;
  gas_reading_unit?: string | null;
  lat?: number | null;
  lng?: number | null;
  beacon_id?: string | null;
  mine_site_id?: string | null;
  zone_id?: string | null;
  edge_score?: number | null;
  edge_flag?: RiskFlag | null;
  edge_reasons_json?: string | null;
  inspection_id?: string | null;
  risk_score_source?: string | null;
  manual_score_reason?: string | null;
}

export class ObservationRepository {
  async insert(input: NewObservationInput): Promise<number> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const doInsert = async () => {
      return await db.runAsync(
        `INSERT INTO local_observations (
          category, description, photo_uri, gas_reading_value, gas_reading_unit,
          lat, lng, beacon_id,
          mine_site_id, zone_id, inspection_id,
          edge_score, edge_flag, edge_reasons_json,
          risk_score_source, manual_score_reason,
          created_at, queued_at, sync_status, retry_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
        [
          input.category,
          input.description,
          input.photo_uri ?? null,
          input.gas_reading_value ?? null,
          input.gas_reading_unit ?? null,
          input.lat ?? null,
          input.lng ?? null,
          input.beacon_id ?? null,
          input.mine_site_id ?? null,
          input.zone_id ?? null,
          input.inspection_id ?? null,
          input.edge_score ?? null,
          input.edge_flag ?? null,
          input.edge_reasons_json ?? null,
          input.risk_score_source ?? "ai_auto",
          input.manual_score_reason ?? null,
          now,
          now,
        ]
      );
    };

    let result;
    try {
      result = await doInsert();
    } catch (insertErr: any) {
      console.warn("Initial insert failed, attempting table migration:", insertErr);
      const cols = [
        "ALTER TABLE local_observations ADD COLUMN inspection_id TEXT DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN gas_reading_value REAL DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN gas_reading_unit TEXT DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN beacon_id TEXT DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN mine_site_id TEXT DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN zone_id TEXT DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN edge_score REAL DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN edge_flag TEXT DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN edge_reasons_json TEXT DEFAULT NULL;",
        "ALTER TABLE local_observations ADD COLUMN risk_score_source TEXT DEFAULT 'ai_auto';",
        "ALTER TABLE local_observations ADD COLUMN manual_score_reason TEXT DEFAULT NULL;",
      ];
      for (const sql of cols) {
        try {
          await db.execAsync(sql);
        } catch {
          // ignore already-exists
        }
      }
      result = await doInsert();
    }

    if (input.inspection_id) {
      try {
        await db.runAsync(
          `UPDATE cached_inspections
           SET observation_count = observation_count + 1
           WHERE id = ?;`,
          [input.inspection_id]
        );
      } catch {
        // non-fatal if table not initialized yet
      }
    }

    return result.lastInsertRowId as number;
  }

  async getAll(): Promise<LocalObservation[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalObservation>(
      `SELECT * FROM local_observations ORDER BY created_at DESC`
    );
  }

  async getById(localId: number): Promise<LocalObservation | null> {
    const db = await getDatabase();
    return db.getFirstAsync<LocalObservation>(
      `SELECT * FROM local_observations WHERE local_id = ?`,
      [localId]
    );
  }

  async getPending(limit = 50): Promise<LocalObservation[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalObservation>(
      `SELECT * FROM local_observations WHERE sync_status = 'pending' ORDER BY queued_at ASC LIMIT ?`,
      [limit]
    );
  }

  async markSynced(localId: number, serverUuid: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE local_observations SET sync_status = 'synced', server_uuid = ?, last_error = NULL WHERE local_id = ?`,
      [serverUuid, localId]
    );
  }

  async markError(localId: number, error: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE local_observations SET sync_status = 'error', last_error = ?, retry_count = retry_count + 1 WHERE local_id = ?`,
      [error, localId]
    );
  }

  async resetToPending(localId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE local_observations SET sync_status = 'pending', last_error = NULL WHERE local_id = ?`,
      [localId]
    );
  }

  async resetAllErrorsToPending(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE local_observations SET sync_status = 'pending', last_error = NULL WHERE sync_status = 'error'`
    );
  }

  async getSyncStats(): Promise<{ total: number; synced: number; pending: number; error: number }> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ sync_status: string; cnt: number }>(
      `SELECT sync_status, COUNT(*) as cnt FROM local_observations GROUP BY sync_status`
    );
    const stats = { total: 0, synced: 0, pending: 0, error: 0 };
    for (const row of rows) {
      stats.total += row.cnt;
      if (row.sync_status === "synced") stats.synced += row.cnt;
      else if (row.sync_status === "pending") stats.pending += row.cnt;
      else if (row.sync_status === "error") stats.error += row.cnt;
    }
    return stats;
  }
}

export const observationRepository = new ObservationRepository();
