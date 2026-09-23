/**
 * labour.ts
 * Mobile API client for statutory labour attendance operations.
 */

import { getApiClient } from "./client";

export interface MobileAttendancePayload {
  worker_id: string;
  worker_name: string;
  mine_site_id: string;
  contractor_id?: string | null;
  shift_date: string;
  shift_type: string;
  clock_in: string;
  clock_out?: string | null;
  hours_worked?: number | null;
  overtime_hours?: number | null;
}

export interface MobileAttendanceResponse {
  id: string;
  worker_id: string;
  worker_name: string;
  mine_site_id: string;
  contractor_id?: string | null;
  shift_date: string;
  shift_type: string;
  clock_in: string;
  clock_out?: string | null;
  hours_worked: number;
  overtime_hours: number;
  is_violation: boolean;
  violation_reason?: string | null;
  created_at: string;
}

export async function submitAttendance(
  payload: MobileAttendancePayload
): Promise<MobileAttendanceResponse> {
  const client = getApiClient();
  const res = await client.post<MobileAttendanceResponse>("/labour/attendance", payload);
  return res.data;
}

export async function fetchAttendanceList(
  mineSiteId?: string
): Promise<MobileAttendanceResponse[]> {
  const client = getApiClient();
  const res = await client.get<MobileAttendanceResponse[]>("/labour/attendance", {
    params: mineSiteId ? { mine_site_id: mineSiteId, limit: 50 } : { limit: 50 },
  });
  return res.data;
}
