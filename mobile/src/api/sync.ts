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
    lat: obs.lat ?? null,
    lng: obs.lng ?? null,
    beacon_id: obs.beacon_id ?? null,
    mine_site_id: obs.mine_site_id ?? null,
    zone_id: obs.zone_id ?? null,
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
