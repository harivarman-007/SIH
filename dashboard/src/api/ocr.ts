/**
 * OCR Queue API — wraps GET /ocr/queue and PATCH /ocr/queue/{id}
 * Accessible to mine_official and regulator only.
 */
import apiClient from './client';

export type OcrReviewStatus = 'pending' | 'approved' | 'rejected';

export interface OcrQueueItem {
  id: string;
  document_name: string | null;
  image_url: string | null;   // relative URL to stream the original uploaded scan
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

export interface OcrSubmitResponse {
  status: string;
  extracted_text?: string;
  queue_item_id?: string;
  overall_confidence?: number;
  word_count?: number;
}

export async function submitOcrDocument(
  file: File | Blob,
  documentName?: string,
  lang: string = 'eng'
): Promise<OcrSubmitResponse> {
  const formData = new FormData();
  formData.append('file', file, documentName || 'statutory_document.png');
  if (documentName) formData.append('document_name', documentName);
  formData.append('lang', lang);

  const res = await apiClient.post<OcrSubmitResponse>('/ocr/submit', formData);
  return res.data;
}
