/**
 * KPI API — wraps GET /kpi/ and GET /kpi/cross-mine-summary
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
  by_category: { safety: number; environment: number; labour: number; production?: number };
  by_risk: { low: number; medium: number; high: number };
}

export interface MineLeaderboardItem {
  mine_id: string;
  mine_name: string;
  location: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  open_violations: number;
  high_risk_count: number;
  total_observations: number;
  compliance_rate_pct: number;
  active_contractors: number;
  trend_sparkline: number[];
}

export interface OpenViolationsDrilldown {
  total: number;
  high_risk: number;
  safety: number;
  environment: number;
  labour: number;
  production?: number;
}

export interface ContractorRiskDrilldown {
  active_contractors: number;
  assigned_violations: number;
  high_risk_contractor_tasks: number;
  avg_compliance_pct: number;
}

export interface CrossMineSummary {
  aggregate_risk_score: number;
  aggregate_risk_level: 'low' | 'medium' | 'high';
  total_mines: number;
  total_observations: number;
  open_violations: OpenViolationsDrilldown;
  contractor_risk: ContractorRiskDrilldown;
  mines_leaderboard: MineLeaderboardItem[];
}

export async function fetchKPIs(): Promise<KPISummary> {
  const res = await apiClient.get<KPISummary>('/kpi/');
  return res.data;
}

export async function fetchCrossMineSummary(): Promise<CrossMineSummary> {
  const res = await apiClient.get<CrossMineSummary>('/kpi/cross-mine-summary');
  return res.data;
}
