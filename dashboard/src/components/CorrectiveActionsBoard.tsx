import React, { useState, useEffect, useMemo } from 'react';
import { fetchActions, fetchAction, verifyAction, rejectAction } from '../api/actions';
import { fetchUsers, UserInfo } from '../api/auth';
import { ActionDetail, ActionPriority, ActionStatus, CorrectiveAction } from '../types/actions';
import { usePermissions } from './providers/PermissionProvider';
import { Permission } from '../types/permissions';

const KANBAN_COLUMNS: { key: ActionStatus; label: string; color: string; border: string }[] = [
  { key: 'assigned', label: 'Assigned', color: 'bg-zinc-800 text-zinc-300', border: 'border-zinc-700' },
  { key: 'accepted', label: 'Accepted', color: 'bg-blue-500/20 text-blue-400', border: 'border-blue-500/30' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-500/20 text-amber-400', border: 'border-amber-500/30' },
  { key: 'pending_verification', label: 'Pending Verification', color: 'bg-purple-500/20 text-purple-400', border: 'border-purple-500/30' },
  { key: 'rejected', label: 'Rejected', color: 'bg-rose-500/20 text-rose-400', border: 'border-rose-500/30' },
  { key: 'closed', label: 'Closed / Verified', color: 'bg-emerald-500/20 text-emerald-400', border: 'border-emerald-500/30' },
];

export const CorrectiveActionsBoard: React.FC = () => {
  const { can } = usePermissions();
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [contractors, setContractors] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [contractorFilter, setContractorFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drawer / Modal states
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<ActionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Verification / Rejection dialogs
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const loadActions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActions();
      setActions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load corrective actions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
    fetchUsers({ role: 'contractor' })
      .then(setContractors)
      .catch(() => setContractors([]));
  }, []);

  // Fetch action detail when card clicked
  useEffect(() => {
    if (!selectedActionId) {
      setActionDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchAction(selectedActionId)
      .then((detail) => {
        setActionDetail(detail);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load action details.');
      })
      .finally(() => setDetailLoading(false));
  }, [selectedActionId]);

  // Filtered actions
  const filteredActions = useMemo(() => {
    const now = new Date().getTime();
    return actions.filter((act) => {
      if (contractorFilter !== 'all' && act.assigned_to_user_id !== contractorFilter) {
        return false;
      }
      if (priorityFilter !== 'all' && act.priority !== priorityFilter) {
        return false;
      }
      if (overdueOnly) {
        const dueTime = new Date(act.due_at).getTime();
        if (dueTime >= now || act.status === 'closed') {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = act.code.toLowerCase().includes(query);
        const matchesTitle = act.title.toLowerCase().includes(query);
        if (!matchesCode && !matchesTitle) {
          return false;
        }
      }
      return true;
    });
  }, [actions, contractorFilter, priorityFilter, overdueOnly, searchQuery]);

  // Group actions by column
  const groupedActions = useMemo(() => {
    const groups: Record<ActionStatus, CorrectiveAction[]> = {
      assigned: [],
      accepted: [],
      in_progress: [],
      pending_verification: [],
      rejected: [],
      verified: [],
      closed: [],
    };
    filteredActions.forEach((act) => {
      // Map verified to closed column if present
      const statusKey = act.status === 'verified' ? 'closed' : act.status;
      if (groups[statusKey]) {
        groups[statusKey].push(act);
      }
    });
    return groups;
  }, [filteredActions]);

  // Handlers for Verify and Reject
  const handleVerify = async () => {
    if (!actionDetail) return;
    setActionProcessing(true);
    setDialogError(null);
    try {
      await verifyAction(actionDetail.id);
      setShowVerifyModal(false);
      setSelectedActionId(null);
      await loadActions();
    } catch (err: any) {
      setDialogError(err.message || 'Failed to verify action.');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!actionDetail) return;
    if (rejectReason.trim().length < 10) {
      setDialogError('Rejection reason must be at least 10 characters long.');
      return;
    }
    setActionProcessing(true);
    setDialogError(null);
    try {
      await rejectAction(actionDetail.id, rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedActionId(null);
      await loadActions();
    } catch (err: any) {
      setDialogError(err.message || 'Failed to reject action.');
    } finally {
      setActionProcessing(false);
    }
  };

  const isOverdue = (dueAtStr: string, status: string) => {
    if (status === 'closed' || status === 'verified') return false;
    return new Date(dueAtStr).getTime() < new Date().getTime();
  };

  const getPriorityBadge = (p: ActionPriority) => {
    switch (p) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/40';
      case 'high':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/40';
      default:
        return 'bg-zinc-700 text-zinc-300';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Filters Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800 backdrop-blur-xl">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            Mine Operations / Statutory Corrective Actions
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Corrective Actions Board</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Strict human-in-the-loop remediation lifecycle (No drag-and-drop: guarded transitions only)
          </p>
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search code or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 w-48 lg:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-zinc-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Contractor Filter */}
          <select
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Contractors</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Overdue Toggle */}
          <button
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              overdueOnly
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-lg shadow-rose-500/10'
                : 'bg-zinc-950 text-zinc-400 border-zinc-700/80 hover:text-zinc-200'
            }`}
          >
            <span>⏰</span>
            <span>Overdue Only</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={loadActions}
            disabled={loading}
            className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-zinc-300 transition-colors"
            title="Refresh board"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>⟳</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Kanban Board Grid (6 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
        {KANBAN_COLUMNS.map((col) => {
          const colActions = groupedActions[col.key] || [];
          return (
            <div
              key={col.key}
              className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3 flex flex-col min-h-[480px] shadow-sm"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.border.replace('border-', 'bg-')}`} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    {col.label}
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                  {colActions.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[70vh] pr-1">
                {colActions.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-zinc-800/60 rounded-xl">
                    <span className="text-xs text-zinc-600 font-medium">No actions</span>
                  </div>
                ) : (
                  colActions.map((act) => {
                    const overdue = isOverdue(act.due_at, act.status);
                    return (
                      <div
                        key={act.id}
                        onClick={() => setSelectedActionId(act.id)}
                        className={`p-3.5 rounded-xl bg-zinc-950 border transition-all cursor-pointer hover:border-amber-500/60 hover:shadow-lg hover:shadow-black/40 group ${
                          overdue
                            ? 'border-rose-500/50 bg-rose-950/10'
                            : 'border-zinc-800/80 hover:bg-zinc-900/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-amber-400 group-hover:text-amber-300">
                            {act.code}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase ${getPriorityBadge(act.priority)}`}>
                            {act.priority}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-white mt-2 line-clamp-2 group-hover:text-amber-100">
                          {act.title}
                        </h4>

                        <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                          <div className="flex items-center gap-1">
                            <span>📅</span>
                            <span className={overdue ? 'text-rose-400 font-semibold' : 'text-zinc-400'}>
                              {new Date(act.due_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>

                          {overdue && (
                            <span className="text-[10px] bg-rose-500/20 text-rose-400 font-bold px-1.5 py-0.5 rounded border border-rose-500/40">
                              OVERDUE
                            </span>
                          )}

                          {act.submission_round > 1 && (
                            <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono" title={`Submission Round ${act.submission_round}`}>
                              R{act.submission_round}
                            </span>
                          )}
                        </div>

                        {act.status === 'pending_verification' && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                            <span>Verification Required</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Detail Slide-over Drawer (Q2) */}
      {selectedActionId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 text-zinc-100 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-500">
                    {actionDetail?.code || 'ACTION'}
                  </span>
                  {actionDetail && (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase ${getPriorityBadge(actionDetail.priority)}`}>
                      {actionDetail.priority}
                    </span>
                  )}
                  {actionDetail && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-zinc-800 text-zinc-300">
                      {actionDetail.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {actionDetail?.title || 'Loading Action...'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedActionId(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="text-center py-20 text-zinc-400">Loading details...</div>
              ) : actionDetail ? (
                <>
                  {/* Rejection Banner if rejected */}
                  {actionDetail.status === 'rejected' && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-amber-400">
                          ⚠️ Action Rejected by Mine Official
                        </span>
                        <span className="text-xs font-mono text-zinc-400">
                          Round {actionDetail.submission_round}
                        </span>
                      </div>
                      <p className="text-xs text-amber-200 bg-black/20 p-2.5 rounded-lg border border-amber-500/20">
                        {actionDetail.rejection_reason || 'No specific reason logged.'}
                      </p>
                    </div>
                  )}

                  {/* Remediation Scope & Description */}
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Remediation Instructions & Scope
                    </h4>
                    <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {actionDetail.description}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Assigned Contractor:</span>
                      <span className="text-white font-medium">
                        {actionDetail.assigned_to_name || actionDetail.assigned_to_user_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Assigned By:</span>
                      <span className="text-white font-medium">
                        {actionDetail.assigned_by_name || actionDetail.assigned_by_user_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Target Deadline:</span>
                      <span className={isOverdue(actionDetail.due_at, actionDetail.status) ? 'text-rose-400 font-bold' : 'text-white font-medium'}>
                        {new Date(actionDetail.due_at).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Safety Standard:</span>
                      <span className="text-white font-medium">
                        {actionDetail.safety_standards_referenced || 'Standard Protocol'}
                      </span>
                    </div>
                  </div>

                  {/* Evidence Gallery */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Proof of Work Evidence ({actionDetail.evidences?.length || 0})
                      </h4>
                    </div>

                    {(!actionDetail.evidences || actionDetail.evidences.length === 0) ? (
                      <div className="p-6 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                        No evidence files uploaded yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {actionDetail.evidences.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                ev.kind === 'after'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : ev.kind === 'before'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}>
                                {ev.kind}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {new Date(ev.uploaded_at).toLocaleDateString()}
                              </span>
                            </div>

                            {ev.file_url.match(/\.(jpeg|jpg|png|gif|webp)$/i) || ev.file_url.startsWith('data:image') ? (
                              <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 h-32">
                                <img
                                  src={ev.file_url}
                                  alt={ev.description || 'Evidence thumbnail'}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-24 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-400 text-xs font-mono">
                                📄 Document Attachment
                              </div>
                            )}

                            {ev.description && (
                              <p className="text-[11px] text-zinc-300 line-clamp-2">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Sticky Action Footer with Guarded Verify/Reject Buttons */}
            {actionDetail && (
              <div className="p-6 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedActionId(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-semibold"
                >
                  Close
                </button>

                {/* Verify / Reject buttons appear ONLY on PENDING_VERIFICATION and with proper permissions (Q2) */}
                {actionDetail.status === 'pending_verification' && (
                  <div className="flex items-center gap-2">
                    {can(Permission.ACTION_REJECT) && (
                      <button
                        onClick={() => {
                          setDialogError(null);
                          setShowRejectModal(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 font-bold text-xs shadow-lg transition-all"
                      >
                        ❌ Reject Submission
                      </button>
                    )}

                    {can(Permission.ACTION_VERIFY) && (
                      <button
                        onClick={() => {
                          setDialogError(null);
                          setShowVerifyModal(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                      >
                        <span>✓</span>
                        <span>Verify & Close Action</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verify Confirmation Modal */}
      {showVerifyModal && actionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Confirm Action Verification</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to approve and close action{' '}
              <strong className="text-amber-400">{actionDetail.code}</strong>? This certifies that
              the contractor proof of work satisfies all statutory safety standards.
            </p>

            {dialogError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                {dialogError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setShowVerifyModal(false)}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={actionProcessing}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs disabled:opacity-50"
              >
                {actionProcessing ? 'Verifying...' : 'Confirm Verification & Closure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Mandatory Reason Modal (Q2: min 10 chars) */}
      {showRejectModal && actionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase text-rose-400">Statutory Rejection</span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Reject Submission for {actionDetail.code}
              </h3>
            </div>

            <p className="text-xs text-zinc-300">
              Enter a mandatory reason detailing why the submitted evidence was rejected. This will
              be displayed prominently to the contractor for remediation rework.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Rejection Reason * (minimum 10 characters)
              </label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                placeholder="Detail why evidence is insufficient or what additional remediation is required..."
              />
              <div className="text-[10px] text-zinc-500 mt-1 text-right">
                {rejectReason.trim().length} / 10 characters minimum
              </div>
            </div>

            {dialogError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                {dialogError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionProcessing || rejectReason.trim().length < 10}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs disabled:opacity-50"
              >
                {actionProcessing ? 'Rejecting...' : 'Reject Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
