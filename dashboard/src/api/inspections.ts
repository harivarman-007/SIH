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

export async function updateInspectionStatus(
  id: string,
  status: InspectionStatus,
  reason?: string
): Promise<Inspection> {
  const response = await apiClient.patch<Inspection>(`/inspections/${id}/status`, {
    status,
    reason,
  });
  return response.data;
}
