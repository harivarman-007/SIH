/**
 * ActionRepository.ts
 * Data access layer for cached corrective actions on mobile (read-only for inspector).
 */

import { getDatabase, CachedAction } from "./schema";

export const actionRepository = {
  async getAll(): Promise<CachedAction[]> {
    const db = await getDatabase();
    return db.getAllAsync<CachedAction>(
      "SELECT * FROM cached_actions ORDER BY deadline ASC;"
    );
  },

  async saveBatch(actions: any[]): Promise<void> {
    if (!actions || actions.length === 0) return;
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      for (const item of actions) {
        await db.runAsync(
          `INSERT INTO cached_actions (
            id, code, observation_id, mine_site_id, title, description,
            priority, status, deadline, submission_round, rejection_reason,
            contractor_id, created_by_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            priority = excluded.priority,
            status = excluded.status,
            deadline = excluded.deadline,
            submission_round = excluded.submission_round,
            rejection_reason = excluded.rejection_reason,
            updated_at = excluded.updated_at;`,
          [
            item.id,
            item.code,
            item.observation_id,
            item.mine_site_id,
            item.title,
            item.description,
            item.priority,
            item.status,
            item.deadline,
            item.submission_round || 1,
            item.rejection_reason || null,
            item.contractor_id || item.assigned_to_user_id,
            item.created_by_id || item.assigned_by_user_id,
            item.updated_at || new Date().toISOString(),
          ]
        );
      }
    });
  },
};
