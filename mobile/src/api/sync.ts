/**
 * sync.ts
 * API calls for syncing observations to the backend /sync/batch endpoint.
 */

import { getApiClient } from "./client";
import { LocalObservation } from "../db/schema";

export interface SyncObservationPayload {
  category: string;
  description: string;
  photo_url?: string | null;
  gas_reading_value?: number | null;
  gas_reading_unit?: string | null;
  lat?: number | null;
  lng?: number | null;
  beacon_id?: string | null;
  mine_site_id?: string | null;
  zone_id?: string | null;
  edge_score?: number | null;
  edge_flag?: string | null;
  edge_reasons?: Record<string, unknown> | null;
  created_at: string;
  has_photo: boolean;
}

export interface SyncBatchResponse {
  synced_count: number;
  created_ids: string[];
  synced_at: string;
}

const DEFAULT_MINE_SITE_ID = "5f92941a-dbf7-4697-a3d7-1c101210523c";
const DEFAULT_ZONE_ID = "f0c1360f-7661-4ca7-9829-9d655458b6d7";

export function localObsToPayload(obs: LocalObservation): SyncObservationPayload {
  let edgeReasons: Record<string, unknown> | null = null;
  if (obs.edge_reasons_json) {
    try {
      edgeReasons = JSON.parse(obs.edge_reasons_json);
    } catch {
      edgeReasons = null;
    }
  }

  return {
    category: obs.category,
    description: obs.description,
    photo_url: obs.photo_uri ?? null,
    gas_reading_value: obs.gas_reading_value ?? null,
    gas_reading_unit: obs.gas_reading_unit ?? null,
    lat: obs.lat ?? null,
    lng: obs.lng ?? null,
    beacon_id: obs.beacon_id ?? null,
    mine_site_id: obs.mine_site_id || DEFAULT_MINE_SITE_ID,
    zone_id: obs.zone_id || DEFAULT_ZONE_ID,
    edge_score: obs.edge_score ?? null,
    edge_flag: obs.edge_flag ?? null,
    edge_reasons: edgeReasons,
    created_at: obs.created_at,
    has_photo: Boolean(obs.photo_uri),
  };
}

export async function postSyncBatch(
  observations: LocalObservation[]
): Promise<SyncBatchResponse> {
  const client = getApiClient();
  const payload = {
    observations: observations.map(localObsToPayload),
  };
  const response = await client.post<SyncBatchResponse>("/sync/batch", payload);
  return response.data;
}
