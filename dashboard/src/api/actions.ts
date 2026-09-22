import apiClient from './client';
import {
  ActionCreatePayload,
  ActionDetail,
  ActionPriority,
  ActionStatus,
  CorrectiveAction,
  EvidenceUploadPayload,
  ActionEvidence,
} from '../types/actions';

export interface ListActionsParams {
  status?: ActionStatus;
  mine_site_id?: string;
  assigned_to_user_id?: string;
  priority?: ActionPriority;
  limit?: number;
  offset?: number;
}

export async function fetchActions(params?: ListActionsParams): Promise<CorrectiveAction[]> {
  const response = await apiClient.get<CorrectiveAction[]>('/actions', { params });
  return response.data;
}

export async function fetchAction(id: string): Promise<ActionDetail> {
  const response = await apiClient.get<ActionDetail>(`/actions/${id}`);
  return response.data;
}

export async function createAction(payload: ActionCreatePayload): Promise<CorrectiveAction> {
  const response = await apiClient.post<CorrectiveAction>('/actions', payload);
  return response.data;
}

export async function acceptAction(id: string): Promise<CorrectiveAction> {
  const response = await apiClient.post<CorrectiveAction>(`/actions/${id}/accept`);
  return response.data;
}

export async function startAction(id: string): Promise<CorrectiveAction> {
  const response = await apiClient.post<CorrectiveAction>(`/actions/${id}/start`);
  return response.data;
}

export async function uploadEvidence(
  id: string,
  payload: EvidenceUploadPayload
): Promise<ActionEvidence> {
  const response = await apiClient.post<ActionEvidence>(`/actions/${id}/evidence`, payload);
  return response.data;
}

export async function submitAction(id: string): Promise<CorrectiveAction> {
  const response = await apiClient.post<CorrectiveAction>(`/actions/${id}/submit`);
  return response.data;
}

export async function verifyAction(id: string): Promise<CorrectiveAction> {
  const response = await apiClient.post<CorrectiveAction>(`/actions/${id}/verify`);
  return response.data;
}

export async function rejectAction(id: string, reason: string): Promise<CorrectiveAction> {
  const response = await apiClient.post<CorrectiveAction>(`/actions/${id}/reject`, { reason });
  return response.data;
}
