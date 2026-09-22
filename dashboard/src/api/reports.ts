import client from './client';

export interface ReportItem {
  id: string;
  type: string;
  scope?: Record<string, any> | null;
  payload: Record<string, any>;
  generated_by_id: string;
  generated_at: string;
}

export async function createReport(data: {
  type: string;
  mine_site_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<ReportItem> {
  const res = await client.post<ReportItem>('/reports', data);
  return res.data;
}

export async function fetchReports(type?: string): Promise<ReportItem[]> {
  const params: Record<string, any> = {};
  if (type) params.type = type;
  const res = await client.get<ReportItem[]>('/reports', { params });
  return res.data;
}

export async function fetchReportDetail(reportId: string): Promise<ReportItem> {
  const res = await client.get<ReportItem>(`/reports/${reportId}`);
  return res.data;
}

export async function exportReportCsv(reportId: string, filename?: string): Promise<void> {
  const res = await client.get(`/reports/${reportId}/export?format=csv`, {
    responseType: 'blob',
  });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `report-${reportId.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
