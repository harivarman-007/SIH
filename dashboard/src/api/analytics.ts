import apiClient from './client';

export interface ZoneHotspotItem {
  zone_id: string;
  zone_name: string;
  mine_site_id: string;
  mine_name: string;
  count_14d: number;
  count_30d: number;
  count_90d: number;
  total_violations: number;
  recent_trend: 'rising' | 'stable' | 'declining';
}

export interface ContractorRankingItem {
  contractor_id: string;
  contractor_name: string;
  rejected_count_14d: number;
  rejected_count_30d: number;
  rejected_count_90d: number;
  total_assigned: number;
  rework_rate_pct: number;
}

export interface DailyTimeSeriesPoint {
  date: string;
  violations_count: number;
  high_risk_count: number;
  compliant_count: number;
}

export interface TrendsAnalyticsResponse {
  mine_site_id?: string | null;
  zone_id?: string | null;
  generated_at: string;
  zone_hotspots: ZoneHotspotItem[];
  contractor_rankings: ContractorRankingItem[];
  time_series: DailyTimeSeriesPoint[];
  summary: {
    active_hotspots: number;
    rising_zones: number;
    total_30d_violations: number;
    contractors_evaluated: number;
  };
}

export async function fetchTrendsAnalytics(params?: {
  mine_site_id?: string;
  zone_id?: string;
}): Promise<TrendsAnalyticsResponse> {
  const res = await apiClient.get<TrendsAnalyticsResponse>('/analytics/trends', { params });
  return res.data;
}
