import React, { useState, useEffect, useMemo } from 'react';
import { fetchActions, fetchAction, verifyAction, rejectAction } from '../api/actions';
import { fetchUsers, UserInfo } from '../api/auth';
import { ActionDetail, ActionPriority, ActionStatus, CorrectiveAction } from '../types/actions';
import { usePermissions } from './providers/PermissionProvider';
import { Permission } from '../types/permissions';
import {
  Clock,
  Calendar,
  RotateCw,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  X,
  Check,
  FileText,
} from 'lucide-react';

const KANBAN_COLUMNS: {
  key: ActionStatus;
  label: string;
  badgeClass: string;
  headerBorder: string;
  dotColor: string;
}[] = [
  { key: 'assigned', label: 'Assigned', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300', headerBorder: 'border-slate-400', dotColor: 'bg-slate-500' },
  { key: 'accepted', label: 'Accepted', badgeClass: 'bg-blue-50 text-blue-800 border-blue-200', headerBorder: 'border-blue-600', dotColor: 'bg-blue-600' },
  { key: 'in_progress', label: 'In Progress', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', headerBorder: 'border-amber-600', dotColor: 'bg-amber-600' },
  { key: 'pending_verification', label: 'Verification', badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200', headerBorder: 'border-indigo-600', dotColor: 'bg-indigo-600' },
  { key: 'rejected', label: 'Rejected', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200', headerBorder: 'border-rose-600', dotColor: 'bg-rose-600' },
  { key: 'closed', label: 'Closed / Verified', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200', headerBorder: 'border-emerald-600', dotColor: 'bg-emerald-600' },
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
      if (priorityFilter !== 'all' && (act.priority || '').toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }
      if (overdueOnly) {
        const dueTime = new Date(act.due_at).getTime();
        if (dueTime >= now || (act.status || '').toLowerCase() === 'closed') {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = (act.code || '').toLowerCase().includes(query);
        const matchesTitle = (act.title || '').toLowerCase().includes(query);
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
      const rawStatus = (act.status || '').toLowerCase();
      const statusKey = (rawStatus === 'verified' ? 'closed' : rawStatus) as ActionStatus;
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
    const s = (status || '').toLowerCase();
    if (s === 'closed' || s === 'verified') return false;
    return new Date(dueAtStr).getTime() < new Date().getTime();
  };

  const getPriorityBadge = (p: ActionPriority | string) => {
    switch ((p || '').toLowerCase()) {
      case 'critical':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'high':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'medium':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'low':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Filters Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-blue-800">
            Mine Operations / Statutory Corrective Actions
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Corrective Actions Board</h1>
          <p className="text-xs text-slate-500 mt-0.5">
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
              className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 w-48 lg:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Contractor Filter */}
          <select
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
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
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
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
                ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-xs'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue Only</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={loadActions}
            disabled={loading}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-600 transition-colors"
            title="Refresh board"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Kanban Board Grid (6 Professional Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
        {KANBAN_COLUMNS.map((col) => {
          const colActions = groupedActions[col.key] || [];
          return (
            <div
              key={col.key}
              className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3 flex flex-col min-h-[500px] shadow-2xs"
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between pb-3 border-b-2 ${col.headerBorder} mb-3 px-1`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {col.label}
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 shadow-2xs">
                  {colActions.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[70vh] pr-1">
                {colActions.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-white/50">
                    <span className="text-xs text-slate-400 font-medium">No actions</span>
                  </div>
                ) : (
                  colActions.map((act) => {
                    const overdue = isOverdue(act.due_at, act.status);
                    return (
                      <div
                        key={act.id}
                        onClick={() => setSelectedActionId(act.id)}
                        className={`p-3.5 rounded-xl bg-white border transition-all cursor-pointer hover:border-blue-500/60 hover:shadow-md group shadow-2xs space-y-2.5 ${
                          overdue
                            ? 'border-rose-300 bg-rose-50/20'
                            : 'border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-blue-800 group-hover:text-blue-600">
                            {act.code}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase ${getPriorityBadge(act.priority)}`}>
                            {act.priority}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-900">
                          {act.title}
                        </h4>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className={overdue ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                              {new Date(act.due_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>

                          {overdue && (
                            <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200">
                              OVERDUE
                            </span>
                          )}

                          {act.submission_round > 1 && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono" title={`Submission Round ${act.submission_round}`}>
                              R{act.submission_round}
                            </span>
                          )}
                        </div>

                        {(act.status || '').toLowerCase() === 'pending_verification' && (
                          <div className="flex items-center gap-1.5 text-[10px] text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
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

      {/* Action Detail Slide-over Drawer */}
      {selectedActionId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity">
          <div className="relative w-full max-w-2xl bg-white border-l border-slate-200 text-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-800">
                    {actionDetail?.code || 'ACTION'}
                  </span>
                  {actionDetail && (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase ${getPriorityBadge(actionDetail.priority)}`}>
                      {actionDetail.priority}
                    </span>
                  )}
                  {actionDetail && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {actionDetail.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {actionDetail?.title || 'Loading Action...'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedActionId(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="text-center py-20 text-slate-400">Loading details...</div>
              ) : actionDetail ? (
                <>
                  {/* Rejection Banner if rejected */}
                  {(actionDetail.status || '').toLowerCase() === 'rejected' && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-rose-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-700" />
                          <span>Action Rejected by Mine Official</span>
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          Round {actionDetail.submission_round}
                        </span>
                      </div>
                      <p className="text-xs text-rose-900 bg-white p-2.5 rounded-lg border border-rose-200">
                        {actionDetail.rejection_reason || 'No specific reason logged.'}
                      </p>
                    </div>
                  )}

                  {/* Remediation Scope & Description */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Remediation Instructions & Scope
                    </h4>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {actionDetail.description}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">Assigned Contractor:</span>
                      <span className="text-slate-900 font-semibold">
                        {actionDetail.assigned_to_name || actionDetail.assigned_to_user_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Assigned By:</span>
                      <span className="text-slate-900 font-semibold">
                        {actionDetail.assigned_by_name || actionDetail.assigned_by_user_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Target Deadline:</span>
                      <span className={isOverdue(actionDetail.due_at, actionDetail.status) ? 'text-rose-600 font-bold' : 'text-slate-900 font-semibold'}>
                        {new Date(actionDetail.due_at).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Safety Standard:</span>
                      <span className="text-slate-900 font-semibold">
                        {actionDetail.safety_standards_referenced || 'Standard DGMS Protocol'}
                      </span>
                    </div>
                  </div>

                  {/* Evidence Gallery */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Proof of Work Evidence ({actionDetail.evidences?.length || 0})
                      </h4>
                    </div>

                    {(!actionDetail.evidences || actionDetail.evidences.length === 0) ? (
                      <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        No evidence files uploaded yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {actionDetail.evidences.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                ev.kind === 'after'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : ev.kind === 'before'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {ev.kind}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(ev.uploaded_at).toLocaleDateString()}
                              </span>
                            </div>

                            {ev.file_url.match(/\.(jpeg|jpg|png|gif|webp)$/i) || ev.file_url.startsWith('data:image') ? (
                              <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-32">
                                <img
                                  src={ev.file_url}
                                  alt={ev.description || 'Evidence thumbnail'}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-24 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-xs font-mono flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <span>Document Attachment</span>
                              </div>
                            )}

                            {ev.description && (
                              <p className="text-[11px] text-slate-600 line-clamp-2">
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
              <div className="p-6 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedActionId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold transition-colors"
                >
                  Close
                </button>

                {(actionDetail.status || '').toLowerCase() === 'pending_verification' && (
                  <div className="flex items-center gap-2">
                    {can(Permission.ACTION_REJECT) && (
                      <button
                        onClick={() => {
                          setDialogError(null);
                          setShowRejectModal(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-semibold text-xs transition-colors flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4 text-rose-700" />
                        <span>Reject Submission</span>
                      </button>
                    )}

                    {can(Permission.ACTION_VERIFY) && (
                      <button
                        onClick={() => {
                          setDialogError(null);
                          setShowVerifyModal(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Confirm Action Verification</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to approve and close action{' '}
              <strong className="text-blue-800">{actionDetail.code}</strong>? This certifies that
              the contractor proof of work satisfies all statutory safety standards.
            </p>

            {dialogError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {dialogError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowVerifyModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={actionProcessing}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{actionProcessing ? 'Verifying...' : 'Confirm Verification & Closure'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Mandatory Reason Modal */}
      {showRejectModal && actionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase text-rose-700">Statutory Rejection</span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                Reject Submission for {actionDetail.code}
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Enter a mandatory reason detailing why the submitted evidence was rejected. This will
              be displayed prominently to the contractor for remediation rework.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Rejection Reason * (minimum 10 characters)
              </label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
                placeholder="Detail why evidence is insufficient or what additional remediation is required..."
              />
              <div className="text-[10px] text-slate-400 mt-1 text-right">
                {rejectReason.trim().length} / 10 characters minimum
              </div>
            </div>

            {dialogError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {dialogError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionProcessing || rejectReason.trim().length < 10}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs disabled:opacity-50"
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
