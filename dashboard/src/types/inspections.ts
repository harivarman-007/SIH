export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'submitted' | 'cancelled';

export interface Inspection {
  id: string;
  code: string;
  mine_site_id: string;
  zone_id?: string;
  title: string;
  assigned_inspector_id: string;
  created_by_id: string;
  scheduled_for: string;
  due_at?: string;
  status: InspectionStatus;
  notes?: string;
  created_at: string;
  updated_at?: string;
  assigned_inspector_name?: string;
  created_by_name?: string;
  mine_site_name?: string;
}

export interface InspectionCreatePayload {
  mine_site_id: string;
  zone_id?: string;
  title: string;
  assigned_inspector_id: string;
  scheduled_for: string;
  due_at?: string;
  notes?: string;
}
