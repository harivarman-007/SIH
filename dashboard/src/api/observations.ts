/**
 * Observations API
 * Wraps GET /observations/ and PATCH /observations/{id}/close
 */
import apiClient from './client';

export type RiskFlag = 'low' | 'medium' | 'high';
export type ObsCategory = 'safety' | 'environment' | 'labour' | 'production';
export type ObsStatus = 'open' | 'in_progress' | 'escalated' | 'closed';

export interface ObservationOut {
  id: string;
  created_at: string;
  synced_at: string | null;
  inspector_id: string;
  mine_site_id: string;
  zone_id: string;
  category: ObsCategory;
  description: string;
  photo_url: string | null;
  has_photo: boolean;
  lat: number | null;
  lng: number | null;
  beacon_id: string | null;
  edge_score: number | null;
  edge_flag: RiskFlag | null;
  edge_reasons: Record<string, unknown> | null;
  cloud_score: number | null;
  cloud_flag: RiskFlag | null;
  cloud_reasons: Record<string, unknown> | null;
  suggested_action: string | null;
  enriched_at: string | null;
  status: ObsStatus;
  closed_at: string | null;
  closed_by_id: string | null;
  closure_photo_url: string | null;
  closure_note: string | null;
  escalated_at: string | null;
  version: number;
}

export async function fetchObservations(params?: {
  status?: ObsStatus;
  cloud_flag?: RiskFlag;
  limit?: number;
}): Promise<ObservationOut[]> {
  const res = await apiClient.get<ObservationOut[]>('/observations/', { params });
  return res.data;
}

export async function closeObservation(
  id: string,
  closureNote: string
): Promise<ObservationOut> {
  const res = await apiClient.patch<ObservationOut>(`/observations/${id}/close`, {
    closure_note: closureNote,
    closure_photo_url: null,
  });
  return res.data;
}
