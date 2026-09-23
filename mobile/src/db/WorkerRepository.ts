/**
 * WorkerRepository.ts
 * Offline-first repository for cached worker master directory records.
 * Provides fast local search and retrieval for statutory muster shift logging.
 */

import { getDatabase, LocalWorker } from "./schema";

export class WorkerRepository {
  async upsertMany(workers: any[]): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    for (const w of workers) {
      await db.runAsync(
        `INSERT INTO local_workers (
          id, badge_number, name, role, contractor_id, contractor_name,
          mine_site_id, mine_site_name, is_active, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          badge_number = excluded.badge_number,
          name = excluded.name,
          role = excluded.role,
          contractor_id = excluded.contractor_id,
          contractor_name = excluded.contractor_name,
          mine_site_id = excluded.mine_site_id,
          mine_site_name = excluded.mine_site_name,
          is_active = excluded.is_active,
          synced_at = excluded.synced_at;`,
        [
          w.id,
          w.badge_number,
          w.name,
          w.role,
          w.contractor_id ?? null,
          w.contractor_name ?? null,
          w.mine_site_id,
          w.mine_site_name ?? null,
          w.is_active ? 1 : 0,
          now,
        ]
      );
    }
  }

  async getAllActive(mineSiteId?: string): Promise<LocalWorker[]> {
    const db = await getDatabase();
    let sql = `SELECT * FROM local_workers WHERE is_active = 1`;
    const params: any[] = [];

    if (mineSiteId) {
      sql += ` AND mine_site_id = ?`;
      params.push(mineSiteId);
    }

    sql += ` ORDER BY name ASC;`;
    const rows = await db.getAllAsync<any>(sql, params);
    return rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
    }));
  }

  async search(query: string, mineSiteId?: string): Promise<LocalWorker[]> {
    const db = await getDatabase();
    const term = `%${query.trim()}%`;
    let sql = `SELECT * FROM local_workers WHERE is_active = 1 AND (name LIKE ? OR badge_number LIKE ? OR role LIKE ?)`;
    const params: any[] = [term, term, term];

    if (mineSiteId) {
      sql += ` AND mine_site_id = ?`;
      params.push(mineSiteId);
    }

    sql += ` ORDER BY name ASC;`;
    const rows = await db.getAllAsync<any>(sql, params);
    return rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
    }));
  }

  async getById(id: string): Promise<LocalWorker | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM local_workers WHERE id = ?;`,
      [id]
    );
    if (!row) return null;
    return {
      ...row,
      is_active: Boolean(row.is_active),
    };
  }
}

export const workerRepository = new WorkerRepository();
