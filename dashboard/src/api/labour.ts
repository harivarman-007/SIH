import apiClient from './client';

export interface WorkerItem {
  id: string;
  badge_number: string;
  name: string;
  role: string;
  contractor_id?: string | null;
  contractor_name?: string | null;
  mine_site_id: string;
  mine_site_name?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkerCreatePayload {
  badge_number: string;
  name: string;
  role: string;
  contractor_id?: string | null;
  mine_site_id: string;
  is_active?: boolean;
}

export interface WorkerUpdatePayload {
  name?: string;
  role?: string;
  contractor_id?: string | null;
  is_active?: boolean;
}

export interface AttendanceItem {
  id: string;
  worker_id: string;
  worker_badge_number: string;
  worker_name: string;
  worker_role?: string | null;
  contractor_id?: string | null;
  contractor_name?: string | null;
  mine_site_id: string;
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

export interface AttendanceCreatePayload {
  worker_id: string;
  shift_date: string;
  shift_type: string;
  clock_in: string;
  clock_out?: string | null;
  hours_worked?: number | null;
  overtime_hours?: number | null;
}

export interface AttendanceBulkPayload {
  worker_ids: string[];
  mine_site_id: string;
  shift_date: string;
  shift_type: string;
  clock_in: string;
  clock_out?: string | null;
}

export interface LabourViolationsSummary {
  total_shifts: number;
  active_workers: number;
  violation_shifts: number;
  overtime_breaches: number;
  rest_breaches: number;
  compliance_rate_pct: number;
}

export interface LabourRule {
  id: string;
  mine_site_id?: string | null;
  max_shift_hours: number;
  max_overtime_hours: number;
  min_rest_hours_between_shifts: number;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Worker Master Directory Endpoints
// ---------------------------------------------------------------------------

export const fetchWorkers = async (params?: {
  mine_site_id?: string;
  query?: string;
  is_active?: boolean;
  limit?: number;
}): Promise<WorkerItem[]> => {
  const res = await apiClient.get<WorkerItem[]>('/workers', { params });
  return res.data;
};

export const createWorker = async (payload: WorkerCreatePayload): Promise<WorkerItem> => {
  const res = await apiClient.post<WorkerItem>('/workers', payload);
  return res.data;
};

export const updateWorker = async (id: string, payload: WorkerUpdatePayload): Promise<WorkerItem> => {
  const res = await apiClient.patch<WorkerItem>(`/workers/${id}`, payload);
  return res.data;
};

// ---------------------------------------------------------------------------
// Statutory Labour Attendance Endpoints
// ---------------------------------------------------------------------------

export const fetchAttendance = async (params?: {
  mine_site_id?: string;
  is_violation?: boolean;
  query?: string;
  worker_id?: string;
  limit?: number;
}): Promise<AttendanceItem[]> => {
  const res = await apiClient.get<AttendanceItem[]>('/labour/attendance', { params });
  return res.data;
};

export const createAttendance = async (payload: AttendanceCreatePayload): Promise<AttendanceItem> => {
  const res = await apiClient.post<AttendanceItem>('/labour/attendance', payload);
  return res.data;
};

export const bulkCreateAttendance = async (payload: AttendanceBulkPayload): Promise<AttendanceItem[]> => {
  const res = await apiClient.post<AttendanceItem[]>('/labour/attendance/bulk', payload);
  return res.data;
};

export const fetchLabourViolations = async (mine_site_id?: string): Promise<LabourViolationsSummary> => {
  const res = await apiClient.get<LabourViolationsSummary>('/labour/violations', {
    params: mine_site_id ? { mine_site_id } : undefined,
  });
  return res.data;
};

export const fetchLabourRules = async (mine_site_id?: string): Promise<LabourRule> => {
  const res = await apiClient.get<LabourRule>('/labour/rules', {
    params: mine_site_id ? { mine_site_id } : undefined,
  });
  return res.data;
};
