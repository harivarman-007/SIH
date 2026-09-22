import React, { useEffect, useState } from 'react';
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
      <div className="flex items-center justify-center p-12 text-zinc-400 text-sm">
        <span className="animate-spin mr-2">⟳</span> Loading Roles & Permissions Matrix…
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            Security & Governance / RBAC
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Roles & Permissions Matrix</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Role-based access control engine, hard-deny invariants & lockout protection
          </p>
        </div>

        <div className="text-xs font-mono bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl text-zinc-400">
          6 Roles • {allPermissions.length} Defined Permissions
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-white ml-3 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Role Selector Tabs (Design Answer 1A) */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
        {rolesData.map((r) => {
          const isSelected = r.role === selectedRole;
          return (
            <button
              key={r.role}
              onClick={() => setSelectedRole(r.role)}
              className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <div>{r.label}</div>
              <div className={`text-[10px] mt-0.5 font-normal ${isSelected ? 'text-black/70' : 'text-zinc-500'}`}>
                {r.user_count} Active Users
              </div>
            </button>
          );
        })}
      </div>

      {/* Role Overview Card */}
      {currentRoleData && (
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-white text-sm">{currentRoleData.label}</span>
            <p className="text-zinc-400 text-xs mt-0.5">{currentRoleData.scope_description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-semibold">
              {currentRoleData.permissions.length} Granted
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-400 border border-rose-800/60 font-semibold">
              {currentRoleData.hard_deny.length} Hard-Denied
            </span>
          </div>
        </div>
      )}

      {/* Permission Filter Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Filter permissions by keyword (e.g. INSPECTION, ACTION, CLOSE, EXPORT)…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Accordion Permission Groups (Design Answer 1A) */}
      <div className="space-y-3">
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
              className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden"
            >
              {/* Group Accordion Header */}
              <button
                type="button"
                onClick={() => toggleGroupExpand(group.groupName)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{group.groupName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                      {grantedCount} / {filteredPerms.length} Active
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{group.description}</p>
                </div>
                <span className="text-xs text-zinc-400 font-bold ml-2">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* Group Permissions List */}
              {isExpanded && (
                <div className="border-t border-zinc-800/80 divide-y divide-zinc-800/50">
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
                        className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-zinc-950/30"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-zinc-200 font-semibold">{perm}</span>
                            {isHardDenied && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                                HARD-DENIED
                              </span>
                            )}
                            {isProtectedLockout && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                                LOCKOUT GUARD
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400">
                            {isHardDenied
                              ? 'Permanently forbidden by statutory separation of duties (spec invariant).'
                              : isProtectedLockout
                              ? 'Essential governance permission protected from accidental revocation.'
                              : 'Configurable operational capability.'}
                          </p>
                        </div>

                        {/* Interactive Toggle */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <button
                            type="button"
                            disabled={isHardDenied || isCurrentToggling}
                            onClick={() => handleToggle(perm, isGranted, isHardDenied, isProtectedLockout)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isGranted ? 'bg-amber-500' : 'bg-zinc-800'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
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
