/**
 * schema.ts
 * SQLite database schema and initializer for offline-first observation storage.
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
  lat: number | null;
  lng: number | null;
  beacon_id: string | null;
  mine_site_id: string | null;
  zone_id: string | null;
  // On-device scoring
  edge_score: number | null;
  edge_flag: RiskFlag | null;
  edge_reasons_json: string | null; // JSON string
  // Timestamps
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
      lat               REAL    DEFAULT NULL,
      lng               REAL    DEFAULT NULL,
      beacon_id         TEXT    DEFAULT NULL,
      mine_site_id      TEXT    DEFAULT NULL,
      zone_id           TEXT    DEFAULT NULL,

      edge_score        REAL    DEFAULT NULL,
      edge_flag         TEXT    DEFAULT NULL,
      edge_reasons_json TEXT    DEFAULT NULL,

      created_at        TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_status
      ON local_observations(sync_status);
  `);
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return openDatabase();
}
