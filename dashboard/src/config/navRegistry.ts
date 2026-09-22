/**
 * Single NAV_REGISTRY driving the Dynamic Sidebar across all 6 roles.
 * Spec §16 & Decision D1, D5: No hardcoded per-role sidebars.
 * Filtering rules (MUST #5):
 *   - Sidebar items are filtered primarily by `requires` (Permission),
 *     while `roles` restricts items to their assigned role-prefix route group.
 */
import { AuthRole } from '../api/auth';
import { Permission } from '../types/permissions';
import { KPISummary } from '../api/kpi';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string; // Lucide icon key name
  roles: AuthRole[];
  requires?: Permission;
  isStubbed?: boolean;
  stubTargetPhase?: number;
  badge?: (kpis: KPISummary | null) => number | undefined;
}

export const NAV_REGISTRY: NavItem[] = [
  // --- MINE OFFICIAL / MANAGER ---
  {
    id: 'manager-overview',
    label: 'Overview',
    path: '/manager/dashboard',
    icon: 'LayoutDashboard',
    roles: ['mine_official'],
    requires: Permission.KPI_VIEW,
  },
  {
    id: 'manager-hazards',
    label: 'Hazards & Observations',
    path: '/manager/hazards',
    icon: 'AlertTriangle',
    roles: ['mine_official'],
    requires: Permission.OBSERVATION_VIEW,
    badge: (kpis) => kpis?.open_high_risk_count,
  },
  {
    id: 'manager-map',
    label: 'Mine Spatial Map',
    path: '/manager/map',
    icon: 'MapPin',
    roles: ['mine_official'],
    requires: Permission.OBSERVATION_VIEW,
  },
  {
    id: 'manager-ocr',
    label: 'OCR Review Queue',
    path: '/manager/ocr',
    icon: 'FileText',
    roles: ['mine_official'],
    requires: Permission.OCR_QUEUE_VIEW,
  },
  {
    id: 'manager-inspections',
    label: 'Inspections',
    path: '/manager/inspections',
    icon: 'ClipboardCheck',
    roles: ['mine_official'],
    requires: Permission.INSPECTION_VIEW,
  },
  {
    id: 'manager-actions',
    label: 'Corrective Actions',
    path: '/manager/actions',
    icon: 'CheckSquare',
    roles: ['mine_official'],
    requires: Permission.ACTION_VIEW,
  },

  // --- CORPORATE MANAGEMENT ---
  {
    id: 'corporate-overview',
    label: 'Fleet Overview',
    path: '/corporate/dashboard',
    icon: 'TrendingUp',
    roles: ['corporate_management'],
    requires: Permission.KPI_VIEW,
  },
  {
    id: 'corporate-mines',
    label: 'Mine Spatial Map',
    path: '/corporate/mines',
    icon: 'MapPin',
    roles: ['corporate_management'],
    requires: Permission.OBSERVATION_VIEW,
  },
  {
    id: 'corporate-analytics',
    label: 'Cross-Mine Analytics',
    path: '/corporate/analytics',
    icon: 'BarChart2',
    roles: ['corporate_management'],
    requires: Permission.KPI_VIEW,
  },
  {
    id: 'corporate-reports',
    label: 'Compliance Reports',
    path: '/corporate/reports',
    icon: 'FileCheck',
    roles: ['corporate_management'],
    requires: Permission.REPORT_VIEW,
  },

  // --- REGULATORY AUTHORITY ---
  {
    id: 'regulator-overview',
    label: 'Statutory Overview',
    path: '/regulator/dashboard',
    icon: 'ShieldCheck',
    roles: ['regulator'],
    requires: Permission.KPI_VIEW,
  },
  {
    id: 'regulator-audit',
    label: 'Cryptographic Audit',
    path: '/regulator/audit',
    icon: 'Lock',
    roles: ['regulator'],
    requires: Permission.AUDIT_VIEW,
  },
  {
    id: 'regulator-hazards',
    label: 'Statutory Records',
    path: '/regulator/hazards',
    icon: 'AlertTriangle',
    roles: ['regulator'],
    requires: Permission.OBSERVATION_VIEW,
  },
  {
    id: 'regulator-map',
    label: 'Mine Spatial Map',
    path: '/regulator/map',
    icon: 'MapPin',
    roles: ['regulator'],
    requires: Permission.OBSERVATION_VIEW,
  },
  {
    id: 'regulator-violations',
    label: 'DGMS Violations',
    path: '/regulator/violations',
    icon: 'FileWarning',
    roles: ['regulator'],
    requires: Permission.OBSERVATION_VIEW,
  },

  // --- FIELD INSPECTOR ---
  {
    id: 'inspector-overview',
    label: 'Inspector Workspace',
    path: '/inspector/dashboard',
    icon: 'Smartphone',
    roles: ['inspector'],
    requires: Permission.OBSERVATION_CREATE,
  },
  {
    id: 'inspector-observations',
    label: 'My Observations',
    path: '/inspector/observations',
    icon: 'Eye',
    roles: ['inspector'],
    requires: Permission.OBSERVATION_VIEW,
  },
  {
    id: 'inspector-inspections',
    label: 'Assigned Inspections',
    path: '/inspector/inspections',
    icon: 'ClipboardCheck',
    roles: ['inspector'],
    requires: Permission.INSPECTION_VIEW,
  },

  // --- CONTRACTOR ---
  {
    id: 'contractor-overview',
    label: 'Assigned Work',
    path: '/contractor/dashboard',
    icon: 'Briefcase',
    roles: ['contractor'],
    requires: Permission.ACTION_VIEW,
  },
  {
    id: 'contractor-actions',
    label: 'Action Remediation',
    path: '/contractor/actions',
    icon: 'CheckSquare',
    roles: ['contractor'],
    requires: Permission.ACTION_VIEW,
  },
  {
    id: 'contractor-performance',
    label: 'Remediation SLA',
    path: '/contractor/performance',
    icon: 'Award',
    roles: ['contractor'],
    requires: Permission.KPI_VIEW,
  },

  // --- SUPER ADMIN ---
  {
    id: 'admin-overview',
    label: 'System Overview',
    path: '/admin/dashboard',
    icon: 'Sliders',
    roles: ['super_admin'],
    requires: Permission.KPI_VIEW,
  },
  {
    id: 'admin-users',
    label: 'User Management',
    path: '/admin/users',
    icon: 'Users',
    roles: ['super_admin'],
    requires: Permission.USER_VIEW,
  },
  {
    id: 'admin-roles',
    label: 'Roles & Permissions',
    path: '/admin/roles',
    icon: 'ShieldCheck',
    roles: ['super_admin'],
    requires: Permission.ROLE_VIEW,
  },
  {
    id: 'admin-rules',
    label: 'Compliance Rules',
    path: '/admin/rules',
    icon: 'FileText',
    roles: ['super_admin'],
    requires: Permission.SETTING_VIEW,
  },
  {
    id: 'admin-mines',
    label: 'Mine Spatial Map',
    path: '/admin/mines',
    icon: 'MapPin',
    roles: ['super_admin'],
    requires: Permission.OBSERVATION_VIEW,
  },
  {
    id: 'admin-audit',
    label: 'Cryptographic Audit',
    path: '/admin/audit',
    icon: 'Lock',
    roles: ['super_admin'],
    requires: Permission.AUDIT_VIEW,
  },
  {
    id: 'admin-system',
    label: 'Governance Settings',
    path: '/admin/system',
    icon: 'Settings',
    roles: ['super_admin'],
    requires: Permission.SETTING_VIEW,
  },
];

/**
 * Filter registry items for a given role and permission check
 */
export function getNavItemsForRole(
  role: AuthRole,
  can: (p: Permission) => boolean
): NavItem[] {
  return NAV_REGISTRY.filter((item) => {
    // 1. Role prefix match
    if (!item.roles.includes(role)) {
      return false;
    }
    // 2. Primary permission check (MUST #5)
    if (item.requires && !can(item.requires)) {
      return false;
    }
    return true;
  });
}
