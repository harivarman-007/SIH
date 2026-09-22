import client from './client';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  mine_site_id?: string | null;
  department?: string | null;
  last_login_at?: string | null;
  is_active: boolean;
  created_at: string;
  permissions?: string[];
  scope?: Record<string, any>;
}

export interface RolePermissionsData {
  role: string;
  label: string;
  user_count: number;
  permissions: string[];
  hard_deny: string[];
  scope_description: string;
}

export interface SlaThresholds {
  high_hours: number;
  medium_hours: number;
  low_hours: number;
}

export interface RiskFlagThresholds {
  high: number;
  medium: number;
  low: number;
}

export interface SystemSettings {
  sla_thresholds: SlaThresholds;
  risk_flag_thresholds: RiskFlagThresholds;
  updated_at?: string | null;
  updated_by_id?: string | null;
}

export interface ComplianceRule {
  id: string;
  category: string;
  code: string;
  description: string;
  default_severity: string;
  statutory_ref?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemHealthData {
  status: string;
  database: string;
  scheduler: string;
  entity_counts: {
    users: number;
    observations: number;
    actions: number;
    inspections: number;
    audit_ledger_entries: number;
  };
  audit_head: {
    entry_id?: number | null;
    entry_hash?: string | null;
    recorded_at?: string | null;
  };
}

export async function fetchAdminUsers(role?: string, is_active?: boolean): Promise<AdminUser[]> {
  const params: Record<string, any> = {};
  if (role) params.role = role;
  if (is_active !== undefined) params.is_active = is_active;
  const res = await client.get<AdminUser[]>('/admin/users', { params });
  return res.data;
}

export async function updateUserStatus(userId: string, is_active: boolean): Promise<AdminUser> {
  const res = await client.patch<AdminUser>(`/admin/users/${userId}/status`, { is_active });
  return res.data;
}

export async function updateUserRole(userId: string, role: string): Promise<AdminUser> {
  const res = await client.patch<AdminUser>(`/admin/users/${userId}/role`, { role });
  return res.data;
}

export async function fetchRolesPermissions(): Promise<RolePermissionsData[]> {
  const res = await client.get<RolePermissionsData[]>('/admin/roles-permissions');
  return res.data;
}

export async function toggleRolePermission(role: string, permission: string, granted: boolean): Promise<any> {
  const res = await client.post('/admin/roles-permissions/toggle', { role, permission, granted });
  return res.data;
}

export async function fetchSystemSettings(): Promise<SystemSettings> {
  const res = await client.get<SystemSettings>('/admin/system-settings');
  return res.data;
}

export async function updateSystemSettings(payload: {
  sla_thresholds?: SlaThresholds;
  risk_flag_thresholds?: RiskFlagThresholds;
}): Promise<SystemSettings> {
  const res = await client.put<SystemSettings>('/admin/system-settings', payload);
  return res.data;
}

export async function fetchComplianceRules(category?: string, is_active?: boolean): Promise<ComplianceRule[]> {
  const params: Record<string, any> = {};
  if (category) params.category = category;
  if (is_active !== undefined) params.is_active = is_active;
  const res = await client.get<ComplianceRule[]>('/admin/compliance-rules', { params });
  return res.data;
}

export async function createComplianceRule(data: {
  category: string;
  code: string;
  description: string;
  default_severity: string;
  statutory_ref?: string;
}): Promise<ComplianceRule> {
  const res = await client.post<ComplianceRule>('/admin/compliance-rules', data);
  return res.data;
}

export async function updateComplianceRule(ruleId: string, update: Partial<ComplianceRule>): Promise<ComplianceRule> {
  const res = await client.patch<ComplianceRule>(`/admin/compliance-rules/${ruleId}`, update);
  return res.data;
}

export async function fetchSystemHealth(): Promise<SystemHealthData> {
  const res = await client.get<SystemHealthData>('/admin/system-health');
  return res.data;
}
