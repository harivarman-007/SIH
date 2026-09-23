/**
 * Intellifusion Dashboard — Application Entry & Router Tree
 * Phase 27: Whole-prefix role guards, dynamic sidebar shell, authenticated route hierarchy.
 * MUST #3: Whole-prefix RoleGuard for all 6 roles (/admin/*, /manager/*, etc.)
 * All 6 role domain routes fully wired with real views and tracked stubs.
 */
import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './components/providers/AuthProvider';
import { PermissionProvider } from './components/providers/PermissionProvider';
import { ProtectedRoute } from './components/guards/ProtectedRoute';
import { RoleGuard } from './components/guards/RoleGuard';
import { PermissionGuard } from './components/guards/PermissionGuard';
import { AppLayout } from './components/AppLayout';
import { LoginForm } from './components/LoginForm';
import { AccessDeniedPage } from './components/AccessDeniedPage';

// Existing operational views
import AdvancedStats from './components/AdvancedStats';
import { CorporateManagementView } from './components/CorporateManagementView';
import ObservationTable from './components/ObservationTable';
import MineMap from './components/MineMap';
import OcrQueueView from './components/OcrQueueView';
import AuditTrailView from './components/AuditTrailView';

// Phase 28a Operational Views
import { CorrectiveActionsBoard } from './components/CorrectiveActionsBoard';
import { InspectionsManagementView } from './components/InspectionsManagementView';
import { ContractorWorkQueue } from './components/ContractorWorkQueue';
import { ContractorPerformanceView } from './components/ContractorPerformanceView';

// Phase 28b Operational Views
import { AssignedFieldInspectionsView } from './components/AssignedFieldInspectionsView';
import { CorporateAnalyticsView } from './components/CorporateAnalyticsView';
import { StatutoryEnforcementView } from './components/StatutoryEnforcementView';
import { UserManagementView } from './components/UserManagementView';
import { SystemSettingsView } from './components/SystemSettingsView';

// Phase 30 Governance & Reporting Views
import { RolesPermissionsView } from './components/RolesPermissionsView';
import { ComplianceRulesView } from './components/ComplianceRulesView';
import { ComplianceReportsView } from './components/ComplianceReportsView';
import { LabourRegisterView } from './components/LabourRegisterView';

import { useAuthStore } from './store/authStore';
import { ROLE_HOME_PATHS, Permission } from './types/permissions';

// Root redirector based on authenticated role
const RootRedirect: React.FC = () => {
  const { user } = useAuthStore();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={ROLE_HOME_PATHS[user.role] || '/login'} replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<LoginForm />} />

            {/* Root Index Redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Authenticated Layout Shell */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>

                {/* 1. MINE OFFICIAL / MANAGER DOMAIN */}
                <Route path="manager" element={<RoleGuard allowedRoles={['mine_official']} />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<AdvancedStats />} />
                  <Route path="hazards" element={<ObservationTable role="mine_official" />} />
                  <Route path="map" element={<MineMap role="mine_official" />} />
                  <Route path="ocr" element={<OcrQueueView role="mine_official" />} />
                  <Route path="inspections" element={<InspectionsManagementView />} />
                  <Route path="actions" element={<CorrectiveActionsBoard />} />
                  <Route path="labour" element={<LabourRegisterView />} />
                  <Route path="*" element={<AccessDeniedPage />} />
                </Route>

                {/* 2. CORPORATE MANAGEMENT DOMAIN */}
                <Route path="corporate" element={<RoleGuard allowedRoles={['corporate_management']} />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<CorporateManagementView />} />
                  <Route path="mines" element={<MineMap role="corporate_management" />} />
                  <Route path="analytics" element={<CorporateAnalyticsView />} />
                  <Route
                    path="reports"
                    element={
                      <PermissionGuard requires={Permission.REPORT_VIEW} fallback={<AccessDeniedPage />}>
                        <ComplianceReportsView />
                      </PermissionGuard>
                    }
                  />
                  <Route path="labour" element={<LabourRegisterView />} />
                  <Route path="*" element={<AccessDeniedPage />} />
                </Route>

                {/* 3. REGULATORY AUTHORITY (DGMS) DOMAIN */}
                <Route path="regulator" element={<RoleGuard allowedRoles={['regulator']} />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<AdvancedStats />} />
                  <Route path="audit" element={<AuditTrailView role="regulator" />} />
                  <Route path="hazards" element={<ObservationTable role="regulator" />} />
                  <Route path="map" element={<MineMap role="regulator" />} />
                  <Route path="violations" element={<StatutoryEnforcementView />} />
                  <Route path="labour" element={<LabourRegisterView />} />
                  <Route path="*" element={<AccessDeniedPage />} />
                </Route>

                {/* 4. FIELD SAFETY INSPECTOR DOMAIN */}
                <Route path="inspector" element={<RoleGuard allowedRoles={['inspector']} />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  {/* Mobile-first Inspector Workspace */}
                  <Route
                    path="dashboard"
                    element={
                      <div className="w-full space-y-5">
                        <div className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                          <div>
                            <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Field Safety Inspector</div>
                            <div className="text-xl font-bold text-slate-900 mt-0.5">Mobile Inspection Workspace</div>
                            <div className="text-xs text-slate-500 mt-0.5">Real-time statutory observation logging & colliery audit records</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                              Operational · Online
                            </span>
                          </div>
                        </div>
                        <ObservationTable role="inspector" />
                      </div>
                    }
                  />
                  <Route path="observations" element={<ObservationTable role="inspector" />} />
                  <Route path="inspections" element={<AssignedFieldInspectionsView />} />
                  <Route path="*" element={<AccessDeniedPage />} />
                </Route>

                {/* 5. CONTRACTOR REMEDIATION DOMAIN */}
                <Route path="contractor" element={<RoleGuard allowedRoles={['contractor']} />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ContractorWorkQueue />} />
                  <Route path="actions" element={<ContractorWorkQueue />} />
                  <Route path="performance" element={<ContractorPerformanceView />} />
                  <Route path="*" element={<AccessDeniedPage />} />
                </Route>

                {/* 6. SUPER ADMIN DOMAIN */}
                <Route path="admin" element={<RoleGuard allowedRoles={['super_admin']} />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<AdvancedStats />} />
                  <Route path="mines" element={<MineMap role="super_admin" />} />
                  <Route path="audit" element={<AuditTrailView role="super_admin" />} />
                  <Route
                    path="users"
                    element={
                      <PermissionGuard requires={Permission.USER_VIEW} fallback={<AccessDeniedPage />}>
                        <UserManagementView />
                      </PermissionGuard>
                    }
                  />
                  <Route
                    path="roles"
                    element={
                      <PermissionGuard requires={Permission.ROLE_VIEW} fallback={<AccessDeniedPage />}>
                        <RolesPermissionsView />
                      </PermissionGuard>
                    }
                  />
                  <Route
                    path="rules"
                    element={
                      <PermissionGuard requires={Permission.SETTING_VIEW} fallback={<AccessDeniedPage />}>
                        <ComplianceRulesView />
                      </PermissionGuard>
                    }
                  />
                  <Route
                    path="system"
                    element={
                      <PermissionGuard requires={Permission.SETTING_VIEW} fallback={<AccessDeniedPage />}>
                        <SystemSettingsView />
                      </PermissionGuard>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <PermissionGuard requires={Permission.REPORT_VIEW} fallback={<AccessDeniedPage />}>
                        <ComplianceReportsView />
                      </PermissionGuard>
                    }
                  />
                  <Route path="labour" element={<LabourRegisterView />} />
                  <Route path="*" element={<AccessDeniedPage />} />
                </Route>

                {/* Fallback 403 / 404 Route */}
                <Route path="*" element={<AccessDeniedPage />} />
              </Route>
            </Route>
          </Routes>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
