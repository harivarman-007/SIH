/**
 * LabourRepository.ts
 * Offline-first repository for statutory labour attendance records.
 * Follows the ObservationRepository pattern with local SQLite storage,
 * status tracking ('pending' | 'synced' | 'error'), and batch sync operations.
 */

import { getDatabase, LocalLabourAttendance } from "./schema";

export interface NewAttendanceInput {
  worker_id: string;
  worker_badge_number?: string;
  worker_name: string;
  worker_role?: string | null;
  mine_site_id: string;
  contractor_id?: string | null;
  shift_date: string;
  shift_type: string;
  clock_in: string;
  clock_out?: string | null;
  hours_worked?: number;
  overtime_hours?: number;
  is_violation?: boolean;
  violation_reason?: string | null;
}

export class LabourRepository {
  async insert(input: NewAttendanceInput): Promise<number> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const result = await db.runAsync(
      `INSERT INTO local_labour_attendance (
        worker_id, worker_badge_number, worker_name, worker_role, mine_site_id, contractor_id,
        shift_date, shift_type, clock_in, clock_out,
        hours_worked, overtime_hours, is_violation, violation_reason,
        created_at, sync_status, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [
        input.worker_id,
        input.worker_badge_number ?? null,
        input.worker_name,
        input.worker_role ?? null,
        input.mine_site_id,
        input.contractor_id ?? null,
        input.shift_date,
        input.shift_type,
        input.clock_in,
        input.clock_out ?? null,
        input.hours_worked ?? 0,
        input.overtime_hours ?? 0,
        input.is_violation ? 1 : 0,
        input.violation_reason ?? null,
        now,
      ]
    );

    return result.lastInsertRowId;
  }

  async getAll(): Promise<LocalLabourAttendance[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM local_labour_attendance ORDER BY created_at DESC;`
    );
    return rows.map((r) => ({
      ...r,
      is_violation: Boolean(r.is_violation),
    }));
  }

  async getPending(): Promise<LocalLabourAttendance[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM local_labour_attendance WHERE sync_status = 'pending' ORDER BY local_id ASC;`
    );
    return rows.map((r) => ({
      ...r,
      is_violation: Boolean(r.is_violation),
    }));
  }

  async markSynced(localId: number, serverUuid: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE local_labour_attendance
       SET sync_status = 'synced', server_uuid = ?, last_error = NULL
       WHERE local_id = ?;`,
      [serverUuid, localId]
    );
  }

  async markError(localId: number, error: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE local_labour_attendance
       SET sync_status = 'error', retry_count = retry_count + 1, last_error = ?
       WHERE local_id = ?;`,
      [error, localId]
    );
  }
}

export const labourRepository = new LabourRepository();
