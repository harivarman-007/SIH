/**
 * KPI API — wraps GET /kpi/
 */
import apiClient from './client';

export interface KPISummary {
  total_observations: number;
  open_count: number;
  in_progress_count: number;
  closed_count: number;
  escalated_count: number;
  open_high_risk_count: number;
  avg_time_to_closure_hours: number | null;
  sync_rate_pct: number;
  by_category: { safety: number; environment: number; labour: number };
  by_risk: { low: number; medium: number; high: number };
}

export async function fetchKPIs(): Promise<KPISummary> {
  const res = await apiClient.get<KPISummary>('/kpi/');
  return res.data;
}
