/**
 * Frontend Permission Codes & Role Prefixes
 * Strictly synchronized with backend `app/authz/permissions.py` (Binding Decisions D1, D3, D4).
 */
import { AuthRole } from '../api/auth';

export enum Permission {
  // Inspection permissions
  INSPECTION_VIEW = 'INSPECTION_VIEW',
  INSPECTION_CREATE = 'INSPECTION_CREATE',
  INSPECTION_ASSIGN = 'INSPECTION_ASSIGN',
  INSPECTION_START = 'INSPECTION_START',
  INSPECTION_SUBMIT = 'INSPECTION_SUBMIT',
  INSPECTION_CANCEL = 'INSPECTION_CANCEL',

  // Observation permissions
  OBSERVATION_VIEW = 'OBSERVATION_VIEW',
  OBSERVATION_CREATE = 'OBSERVATION_CREATE',
  OBSERVATION_REVIEW = 'OBSERVATION_REVIEW',
  OBSERVATION_CLOSE = 'OBSERVATION_CLOSE',

  // Risk & Anomaly permissions
  RISK_VIEW = 'RISK_VIEW',
  RISK_ESCALATE = 'RISK_ESCALATE',

  // Corrective Action permissions
  ACTION_VIEW = 'ACTION_VIEW',
  ACTION_CREATE = 'ACTION_CREATE',
  ACTION_ACCEPT = 'ACTION_ACCEPT',
  ACTION_START = 'ACTION_START',
  ACTION_PROGRESS = 'ACTION_PROGRESS',
  ACTION_SUBMIT = 'ACTION_SUBMIT',
  ACTION_VERIFY = 'ACTION_VERIFY',
  ACTION_REJECT = 'ACTION_REJECT',

  // Evidence permissions
  EVIDENCE_VIEW = 'EVIDENCE_VIEW',
  EVIDENCE_UPLOAD = 'EVIDENCE_UPLOAD',

  // Audit permissions
  AUDIT_VIEW = 'AUDIT_VIEW',
  AUDIT_VERIFY = 'AUDIT_VERIFY',
  AUDIT_EXPORT = 'AUDIT_EXPORT',

  // KPI & Reporting permissions
  KPI_VIEW = 'KPI_VIEW',
  REPORT_VIEW = 'REPORT_VIEW',
  REPORT_CREATE = 'REPORT_CREATE',
  REPORT_EXPORT = 'REPORT_EXPORT',

  // Document OCR permissions
  OCR_SUBMIT = 'OCR_SUBMIT',
  OCR_QUEUE_VIEW = 'OCR_QUEUE_VIEW',
  OCR_REVIEW = 'OCR_REVIEW',

  // Alerts & Notifications
  ALERT_VIEW = 'ALERT_VIEW',
  ALERT_DISMISS = 'ALERT_DISMISS',

  // User & Access Management
  USER_VIEW = 'USER_VIEW',
  USER_CREATE = 'USER_CREATE',
  USER_EDIT = 'USER_EDIT',
  USER_DISABLE = 'USER_DISABLE',

  // Role & Permissions Administration
  ROLE_VIEW = 'ROLE_VIEW',
  ROLE_ASSIGN = 'ROLE_ASSIGN',

  // Governance & System Settings
  SETTING_VIEW = 'SETTING_VIEW',
  SETTING_EDIT = 'SETTING_EDIT',
}

/**
 * Binding Decision D1: Route prefixes for each role
 */
export const ROLE_PREFIXES: Record<AuthRole, string> = {
  super_admin: '/admin',
  corporate_management: '/corporate',
  mine_official: '/manager',
  inspector: '/inspector',
  contractor: '/contractor',
  regulator: '/regulator',
};

/**
 * Default home path for each role
 */
export const ROLE_HOME_PATHS: Record<AuthRole, string> = {
  super_admin: '/admin/dashboard',
  corporate_management: '/corporate/dashboard',
  mine_official: '/manager/dashboard',
  inspector: '/inspector/dashboard',
  contractor: '/contractor/dashboard',
  regulator: '/regulator/dashboard',
};

/**
 * Human-readable role labels
 */
export const ROLE_LABELS: Record<AuthRole, string> = {
  super_admin: 'Super Admin',
  corporate_management: 'Corporate Management',
  mine_official: 'Mine Manager',
  inspector: 'Field Inspector',
  contractor: 'Contractor',
  regulator: 'Regulatory Authority',
};
