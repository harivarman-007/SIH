import apiClient from './client';
import { Inspection, InspectionCreatePayload, InspectionStatus } from '../types/inspections';

export interface ListInspectionsParams {
  status?: InspectionStatus;
  mine_site_id?: string;
  limit?: number;
  offset?: number;
}

export async function fetchInspections(params?: ListInspectionsParams): Promise<Inspection[]> {
  const response = await apiClient.get<Inspection[]>('/inspections', { params });
  return response.data;
}

export async function fetchInspection(id: string): Promise<Inspection> {
  const response = await apiClient.get<Inspection>(`/inspections/${id}`);
  return response.data;
}

export async function createInspection(payload: InspectionCreatePayload): Promise<Inspection> {
  const response = await apiClient.post<Inspection>('/inspections', payload);
  return response.data;
}

export async function startInspection(id: string): Promise<Inspection> {
  const response = await apiClient.post<Inspection>(`/inspections/${id}/start`);
  return response.data;
}

export async function submitInspection(id: string, notes?: string): Promise<Inspection> {
  const response = await apiClient.post<Inspection>(`/inspections/${id}/submit`, { notes });
  return response.data;
}

export async function completeInspection(id: string, notes?: string): Promise<Inspection> {
  const response = await apiClient.post<Inspection>(`/inspections/${id}/complete`, { notes });
  return response.data;
}

export async function cancelInspection(id: string, reason?: string): Promise<Inspection> {
  const response = await apiClient.post<Inspection>(`/inspections/${id}/cancel`, { reason });
  return response.data;
}

export async function updateInspectionStatus(
  id: string,
  status: InspectionStatus,
  reason?: string
): Promise<Inspection> {
  const s = (status || '').toLowerCase();
  if (s === 'in_progress') {
    return startInspection(id);
  }
  if (s === 'submitted') {
    return submitInspection(id, reason);
  }
  if (s === 'completed') {
    return completeInspection(id, reason);
  }
  if (s === 'cancelled') {
    return cancelInspection(id, reason);
  }
  const response = await apiClient.patch<Inspection>(`/inspections/${id}/status`, {
    status,
    notes: reason,
    reason,
  });
  return response.data;
}
