/**
 * Alerts API — wraps GET /alerts and PATCH /alerts/{id}/read
 */
import apiClient from './client';

export interface Alert {
  id: string;
  recipient_role: string;
  mine_site_id: string | null;
  observation_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export async function fetchAlerts(unreadOnly = false): Promise<Alert[]> {
  const res = await apiClient.get<Alert[]>('/alerts', {
    params: { unread_only: unreadOnly },
  });
  return res.data;
}

export async function markAlertRead(id: string): Promise<Alert> {
  const res = await apiClient.patch<Alert>(`/alerts/${id}/read`);
  return res.data;
}
