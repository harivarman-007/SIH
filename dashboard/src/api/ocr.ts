/**
 * OCR Queue API — wraps GET /ocr/queue and PATCH /ocr/queue/{id}
 * Accessible to mine_official and regulator only.
 */
import apiClient from './client';

export type OcrReviewStatus = 'pending' | 'approved' | 'rejected';

export interface OcrQueueItem {
  id: string;
  document_name: string | null;
  raw_text: string;
  overall_confidence: number;
  confidence_map: Record<string, number>; // word -> confidence score
  status: OcrReviewStatus;
  submitted_by_id: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface OcrReviewRequest {
  status: 'approved' | 'rejected';
  corrected_text?: string;
  notes?: string;
}

export async function fetchOcrQueue(statusFilter: OcrReviewStatus = 'pending'): Promise<OcrQueueItem[]> {
  const res = await apiClient.get<OcrQueueItem[]>('/ocr/queue', {
    params: { status: statusFilter },
  });
  return res.data;
}

export async function reviewOcrItem(
  id: string,
  action: OcrReviewRequest
): Promise<OcrQueueItem> {
  const res = await apiClient.patch<OcrQueueItem>(`/ocr/queue/${id}`, action);
  return res.data;
}
