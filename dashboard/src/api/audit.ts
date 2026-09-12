/**
 * Audit Trail API — wraps GET /audit/verify and GET /audit/log
 */
import apiClient from './client';

export interface AuditLogEntry {
  id: number;
  entry_hash: string;
  prev_hash: string;
  actor_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  ts: string;
}

export interface AuditVerifyResult {
  is_valid: boolean;
  total_checked: number;
  broken_at_id: number | null;
  message: string;
}

/** Available to all authenticated users */
export async function verifyAuditChain(): Promise<AuditVerifyResult> {
  const res = await apiClient.get<AuditVerifyResult>('/audit/verify');
  return res.data;
}

/** Regulator-only: 403 for other roles */
export async function fetchAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  const res = await apiClient.get<AuditLogEntry[]>('/audit/log', {
    params: { limit },
  });
  return res.data;
}
