import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  fetchRolesPermissions,
  toggleRolePermission,
  RolePermissionsData,
} from '../api/admin';

interface PermissionGroup {
  groupName: string;
  prefix: string;
  description: string;
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  { groupName: 'Inspections', prefix: 'INSPECTION_', description: 'Statutory field surveys, scheduling, execution, and sign-offs' },
  { groupName: 'Observations', prefix: 'OBSERVATION_', description: 'Field hazard logs, risk classifications, review, and closure' },
  { groupName: 'Risk & Telemetry', prefix: 'RISK_', description: 'Gas anomaly thresholds and SLA escalations' },
  { groupName: 'Corrective Actions', prefix: 'ACTION_', description: 'Remediation work orders, assignment, progress, verify, and reject' },
  { groupName: 'Evidence & Media', prefix: 'EVIDENCE_', description: 'Proof-of-work before/after photos and geotagged documentation' },
  { groupName: 'Audit & Compliance', prefix: 'AUDIT_', description: 'Tamper-evident SHA-256 hash-chain verification and exports' },
  { groupName: 'KPIs & Reports', prefix: 'REPORT_', description: 'Statutory compliance snapshots, violations ledger, and CSV exports' },
  { groupName: 'OCR Digitization', prefix: 'OCR_', description: 'Logsheet scan ingestion, multilingual OCR, and review queue' },
  { groupName: 'Alerts & Reminders', prefix: 'ALERT_', description: 'Operational notifications and statutory hazard broadcast' },
  { groupName: 'Users & Access', prefix: 'USER_', description: 'Personnel provisioning, status management, and credential control' },
  { groupName: 'Role Administration', prefix: 'ROLE_', description: 'Role assignments and permission matrix enforcement' },
  { groupName: 'System Governance', prefix: 'SETTING_', description: 'SLA parameters, risk calibration, and compliance rules' },
];

export const RolesPermissionsView: React.FC = () => {
  const [rolesData, setRolesData] = useState<RolePermissionsData[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('super_admin');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Inspections: true,
    Observations: true,
    'Corrective Actions': true,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadMatrix = async () => {
    try {
      setLoading(true);
      const data = await fetchRolesPermissions();
      setRolesData(data);
      if (data.length > 0 && !data.find((r) => r.role === selectedRole)) {
        setSelectedRole(data[0].role);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to load permissions matrix.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, []);

  const currentRoleData = rolesData.find((r) => r.role === selectedRole);

  const handleToggle = async (perm: string, currentGranted: boolean, isHardDenied: boolean, isProtected: boolean) => {
    if (isHardDenied) {
      setFeedback({
        type: 'error',
        message: `Permission '${perm}' is permanently HARD-DENIED for role '${selectedRole}'.`,
      });
      return;
    }
    if (isProtected && currentGranted) {
      setFeedback({
        type: 'error',
        message: `Cannot revoke protected governance permission '${perm}' from Super Admin (Lockout Guard).`,
      });
      return;
    }

    try {
      setToggling(perm);
      setFeedback(null);
      await toggleRolePermission(selectedRole, perm, !currentGranted);
      // Optimistic update
      setRolesData((prev) =>
        prev.map((r) => {
          if (r.role !== selectedRole) return r;
          const updatedPerms = currentGranted
            ? r.permissions.filter((p) => p !== perm)
            : [...r.permissions, perm];
          return { ...r, permissions: updatedPerms };
        })
      );
      setFeedback({
        type: 'success',
        message: `Permission '${perm}' ${!currentGranted ? 'granted to' : 'revoked from'} ${currentRoleData?.label}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to toggle permission.',
      });
    } finally {
      setToggling(null);
    }
  };

  const toggleGroupExpand = (groupName: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400 text-xs">
        <RefreshCw className="size-4 animate-spin text-blue-700 mr-2" />
        <span>Loading Roles & Permissions Matrix…</span>
      </div>
    );
  }

  // Collect all distinct permissions across the entire platform
  const allPermissionsSet = new Set<string>();
  rolesData.forEach((r) => {
    r.permissions.forEach((p) => allPermissionsSet.add(p));
    r.hard_deny.forEach((p) => allPermissionsSet.add(p));
  });
  const allPermissions = Array.from(allPermissionsSet).sort();

  const formatRoleLabel = (r: RolePermissionsData) => {
    if (r.label && !r.label.includes('_')) return r.label;
    return r.role
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Security & Governance / RBAC
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Roles & Permissions Matrix</h1>
          <p className="text-xs text-slate-500 mt-1">
            Role-based access control engine, hard-deny invariants & lockout protection
          </p>
        </div>

        <div className="text-xs font-mono bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl text-slate-600 font-semibold shadow-2xs self-start sm:self-auto">
          6 Roles • {allPermissions.length} Defined Permissions
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer ml-3"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Role Selector Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 p-2 bg-slate-100/80 border border-slate-200 rounded-2xl">
        {rolesData.map((r) => {
          const isSelected = r.role === selectedRole;
          return (
            <button
              key={r.role}
              type="button"
              onClick={() => setSelectedRole(r.role)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl text-xs transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/70 shadow-2xs'
              }`}
            >
              <span className="font-bold text-center leading-tight">{formatRoleLabel(r)}</span>
              <span className={`text-[10px] mt-1 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                {r.user_count} Active {r.user_count === 1 ? 'User' : 'Users'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Role Overview Card */}
      {currentRoleData && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="font-bold text-slate-900 text-base">{formatRoleLabel(currentRoleData)}</span>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">{currentRoleData.scope_description}</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {currentRoleData.permissions.length} Granted
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              {currentRoleData.hard_deny.length} Hard-Denied
            </span>
          </div>
        </div>
      )}

      {/* Permission Filter Search Bar */}
      <div className="relative">
        <Search className="size-4 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Filter permissions by keyword (e.g. INSPECTION, ACTION, CLOSE, EXPORT)…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-10 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-700 shadow-2xs transition-colors"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-3 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Accordion Permission Groups */}
      <div className="space-y-4">
        {PERMISSION_GROUPS.map((group) => {
          const groupPerms = allPermissions.filter((p) => p.startsWith(group.prefix));
          const filteredPerms = groupPerms.filter((p) =>
            p.toLowerCase().includes(searchTerm.toLowerCase())
          );

          if (filteredPerms.length === 0) return null;

          const isExpanded = expandedGroups[group.groupName] ?? false;
          const grantedCount = filteredPerms.filter((p) => currentRoleData?.permissions.includes(p)).length;

          return (
            <div
              key={group.groupName}
              className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden"
            >
              {/* Group Accordion Header */}
              <button
                type="button"
                onClick={() => toggleGroupExpand(group.groupName)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-slate-900">{group.groupName}</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-semibold">
                      {grantedCount} / {filteredPerms.length} Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                </div>
                <div className="text-slate-400 p-1">
                  {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </div>
              </button>

              {/* Group Permissions List */}
              {isExpanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                  {filteredPerms.map((perm) => {
                    const isGranted = currentRoleData?.permissions.includes(perm) ?? false;
                    const isHardDenied = currentRoleData?.hard_deny.includes(perm) ?? false;
                    const isProtectedLockout =
                      selectedRole === 'super_admin' &&
                      (perm.startsWith('USER_') || perm.startsWith('ROLE_') || perm.startsWith('SETTING_') || perm.startsWith('AUDIT_'));
                    const isCurrentToggling = toggling === perm;

                    return (
                      <div
                        key={perm}
                        className="p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-900 font-semibold">{perm}</span>
                            {isHardDenied && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                HARD-DENIED
                              </span>
                            )}
                            {isProtectedLockout && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                LOCKOUT GUARD
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {isHardDenied
                              ? 'Permanently forbidden by statutory separation of duties (spec invariant).'
                              : isProtectedLockout
                              ? 'Essential governance permission protected from accidental revocation.'
                              : 'Configurable operational capability.'}
                          </p>
                        </div>

                        {/* Interactive Toggle */}
                        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                          <button
                            type="button"
                            disabled={isHardDenied || isCurrentToggling}
                            onClick={() => handleToggle(perm, isGranted, isHardDenied, isProtectedLockout)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isGranted ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                                isGranted ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
