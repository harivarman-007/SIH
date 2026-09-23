export type ActionStatus =
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'pending_verification'
  | 'rejected'
  | 'verified'
  | 'closed';

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

export type EvidenceKind = 'before' | 'after' | 'document' | 'before_photo' | 'after_photo' | 'note';

export interface ActionEvidence {
  id: string;
  action_id: string;
  kind: EvidenceKind;
  file_url: string;
  hash_sha256?: string;
  file_size_bytes?: number;
  uploaded_by_id: string;
  uploaded_at: string;
  description?: string;
}

export interface CorrectiveAction {
  id: string;
  code: string;
  observation_id: string;
  mine_site_id: string;
  title: string;
  description: string;
  assigned_to_user_id: string;
  assigned_by_user_id: string;
  priority: ActionPriority;
  status: ActionStatus;
  due_at: string;
  safety_standards_referenced?: string;
  submission_round: number;
  rejection_reason?: string;
  accepted_at?: string;
  started_at?: string;
  submitted_at?: string;
  verified_at?: string;
  verified_by_user_id?: string;
  closed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface ActionDetail extends CorrectiveAction {
  evidences: ActionEvidence[];
  assigned_to_name?: string;
  assigned_by_name?: string;
  verified_by_name?: string;
  observation_title?: string;
  observation_location?: string;
  observation_risk_level?: string;
}

export interface ActionCreatePayload {
  observation_id: string;
  assigned_to_user_id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  due_at: string;
  safety_standards_referenced?: string | string[];
}

export interface EvidenceUploadPayload {
  kind: EvidenceKind;
  file_url: string;
  hash_sha256?: string;
  file_size_bytes?: number;
  description?: string;
}
