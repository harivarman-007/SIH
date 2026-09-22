/**
 * schema.ts
 * SQLite database schema and initializer for offline-first observation,
 * inspection caching, action caching, and inspection event outbox.
 * Uses expo-sqlite v14 (new API with useSQLiteContext hook pattern).
 */

import * as SQLite from "expo-sqlite";

export type SyncStatus = "pending" | "synced" | "error";
export type ObservationCategory = "safety" | "environment" | "labour" | "production";
export type RiskFlag = "low" | "medium" | "high";

export interface LocalObservation {
  local_id: number;
  server_uuid: string | null;
  sync_status: SyncStatus;
  retry_count: number;
  last_error: string | null;
  queued_at: string;
  // Core observation fields
  category: ObservationCategory;
  description: string;
  photo_uri: string | null;
  gas_reading_value: number | null;
  gas_reading_unit: string | null;
  lat: number | null;
  lng: number | null;
  beacon_id: string | null;
  mine_site_id: string | null;
  zone_id: string | null;
  inspection_id?: string | null;
  // On-device scoring
  edge_score: number | null;
  edge_flag: RiskFlag | null;
  edge_reasons_json: string | null; // JSON string
  // Timestamps
  created_at: string;
}

export interface CachedInspection {
  id: string; // server uuid
  code: string; // INS-xxxx
  mine_site_id: string;
  zone_id: string | null;
  title: string;
  assigned_inspector_id: string;
  scheduled_for: string;
  due_at: string;
  status: string; // SCHEDULED, IN_PROGRESS, COMPLETED, SUBMITTED, CLOSED
  started_at: string | null;
  completed_at: string | null;
  submitted_at: string | null;
  notes: string | null;
  observation_count: number;
  updated_at: string;
}

export interface CachedAction {
  id: string;
  code: string;
  observation_id: string;
  mine_site_id: string;
  title: string;
  description: string;
  priority: string;
  status: string; // ASSIGNED, ACCEPTED, IN_PROGRESS, PENDING_VERIFICATION, REJECTED, CLOSED
  deadline: string;
  submission_round: number;
  rejection_reason: string | null;
  contractor_id: string;
  created_by_id: string;
  updated_at: string;
}

export interface InspectionOutboxItem {
  id: number;
  inspection_id: string;
  event_type: "START" | "COMPLETE" | "SUBMIT";
  payload_json: string;
  status: SyncStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

export const DB_NAME = "intellifusion.db";

let _db: SQLite.SQLiteDatabase | null = null;

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await initSchema(_db);
  return _db;
}

export async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS local_observations (
      local_id          INTEGER PRIMARY KEY AUTOINCREMENT,
      server_uuid       TEXT    DEFAULT NULL,
      sync_status       TEXT    NOT NULL DEFAULT 'pending',
      retry_count       INTEGER NOT NULL DEFAULT 0,
      last_error        TEXT    DEFAULT NULL,
      queued_at         TEXT    NOT NULL,

      category          TEXT    NOT NULL,
      description       TEXT    NOT NULL,
      photo_uri         TEXT    DEFAULT NULL,
      gas_reading_value REAL    DEFAULT NULL,
      gas_reading_unit  TEXT    DEFAULT NULL,
      lat               REAL    DEFAULT NULL,
      lng               REAL    DEFAULT NULL,
      beacon_id         TEXT    DEFAULT NULL,
      mine_site_id      TEXT    DEFAULT NULL,
      zone_id           TEXT    DEFAULT NULL,
      inspection_id     TEXT    DEFAULT NULL,

      edge_score        REAL    DEFAULT NULL,
      edge_flag         TEXT    DEFAULT NULL,
      edge_reasons_json TEXT    DEFAULT NULL,

      created_at        TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_status
      ON local_observations(sync_status);

    -- Phase 29: Cached Inspections Table
    CREATE TABLE IF NOT EXISTS cached_inspections (
      id                    TEXT PRIMARY KEY,
      code                  TEXT NOT NULL,
      mine_site_id          TEXT NOT NULL,
      zone_id               TEXT DEFAULT NULL,
      title                 TEXT NOT NULL,
      assigned_inspector_id TEXT NOT NULL,
      scheduled_for         TEXT NOT NULL,
      due_at                TEXT NOT NULL,
      status                TEXT NOT NULL,
      started_at            TEXT DEFAULT NULL,
      completed_at          TEXT DEFAULT NULL,
      submitted_at          TEXT DEFAULT NULL,
      notes                 TEXT DEFAULT NULL,
      observation_count     INTEGER DEFAULT 0,
      updated_at            TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inspections_status
      ON cached_inspections(status);

    -- Phase 29: Cached Corrective Actions Table
    CREATE TABLE IF NOT EXISTS cached_actions (
      id                TEXT PRIMARY KEY,
      code              TEXT NOT NULL,
      observation_id    TEXT NOT NULL,
      mine_site_id      TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT NOT NULL,
      priority          TEXT NOT NULL,
      status            TEXT NOT NULL,
      deadline          TEXT NOT NULL,
      submission_round  INTEGER DEFAULT 1,
      rejection_reason  TEXT DEFAULT NULL,
      contractor_id     TEXT NOT NULL,
      created_by_id     TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_actions_status
      ON cached_actions(status);

    -- Phase 29: Inspection Outbox Table for Offline Event Queuing
    CREATE TABLE IF NOT EXISTS inspection_outbox (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      payload_json  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      retry_count   INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT DEFAULT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_status
      ON inspection_outbox(status);

    -- Phase 29: Sync Metadata Table (watermarks, sync state)
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return openDatabase();
}
