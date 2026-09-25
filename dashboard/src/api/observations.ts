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
  gas_reading_value?: number | null;
  gas_reading_unit?: string | null;
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
  compliance_status?: string | null;
  threshold_breach_detail?: string | null;
  risk_score_source?: 'ai_auto' | 'manual' | 'dgms_override' | string;
  manual_score_reason?: string | null;
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

export interface ObservationCreatePayload {
  category: ObsCategory;
  description: string;
  mine_site_id?: string;
  zone_id?: string;
  inspection_id?: string;
  photo_url?: string;
  has_photo?: boolean;
  lat?: number;
  lng?: number;
  beacon_id?: string;
  edge_flag?: RiskFlag;
  edge_score?: number;
  gas_reading_value?: number;
  gas_reading_unit?: string;
  risk_score_source?: 'ai_auto' | 'manual' | 'dgms_override' | string;
  manual_score_reason?: string;
}

export async function createObservation(
  payload: ObservationCreatePayload
): Promise<ObservationOut> {
  const res = await apiClient.post<ObservationOut>('/observations/', payload);
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

