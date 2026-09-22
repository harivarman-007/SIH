import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  fetchActions,
  fetchAction,
  acceptAction,
  startAction,
  uploadEvidence,
  submitAction,
} from '../api/actions';
import { ActionDetail, ActionPriority, CorrectiveAction, EvidenceKind } from '../types/actions';

interface StagedFile {
  file: File;
  previewUrl: string;
  kind: EvidenceKind;
  description: string;
  geo?: { lat: number; lng: number };
}

export const ContractorWorkQueue: React.FC = () => {
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected action for detailed execution
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<ActionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Remediation / execution states
  const [processing, setProcessing] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionSuccess, setExecutionSuccess] = useState<string | null>(null);

  // Staged evidences for upload (Q3)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [geoPrompted, setGeoPrompted] = useState(false);
  const [currentGeo, setCurrentGeo] = useState<{ lat: number; lng: number } | null>(null);

  const filePickerRef = useRef<HTMLInputElement>(null);
  const cameraPickerRef = useRef<HTMLInputElement>(null);

  const loadActions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActions();
      setActions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load assigned actions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, []);

  // Request browser geolocation once (Q3)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation && !geoPrompted) {
      setGeoPrompted(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentGeo({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Graceful fallback if user denies or location is unavailable
          setCurrentGeo(null);
        },
        { timeout: 8000 }
      );
    }
  }, [geoPrompted]);

  // Load detail when action selected
  useEffect(() => {
    if (!selectedActionId) {
      setActionDetail(null);
      setStagedFiles([]);
      setCompletionNotes('');
      setExecutionError(null);
      setExecutionSuccess(null);
      return;
    }

    setDetailLoading(true);
    fetchAction(selectedActionId)
      .then((detail) => {
        setActionDetail(detail);
      })
      .catch((err) => {
        setExecutionError(err.message || 'Failed to load action details.');
      })
      .finally(() => setDetailLoading(false));
  }, [selectedActionId]);

  // Handle file staging with client validation (Q3)
  const handleFilesSelected = (files: FileList | null, defaultKind: EvidenceKind = 'after') => {
    if (!files || files.length === 0) return;
    setExecutionError(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    const newStaged: StagedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!allowedTypes.includes(file.type)) {
        setExecutionError(`File ${file.name} has unsupported type (${file.type}). Allowed: JPG, PNG, WEBP, PDF.`);
        continue;
      }

      if (file.size > maxSizeBytes) {
        setExecutionError(`File ${file.name} exceeds 10MB limit.`);
        continue;
      }

      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';

      newStaged.push({
        file,
        previewUrl,
        kind: defaultKind,
        description: `Proof of remediation for ${actionDetail?.code || 'action'}`,
        geo: currentGeo || undefined,
      });
    }

    setStagedFiles((prev) => [...prev, ...newStaged]);
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => {
      const copy = [...prev];
      const removed = copy.splice(index, 1)[0];
      if (removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return copy;
    });
  };

  const updateStagedKind = (index: number, kind: EvidenceKind) => {
    setStagedFiles((prev) => {
      const copy = [...prev];
      copy[index].kind = kind;
      return copy;
    });
  };

  const updateStagedDescription = (index: number, desc: string) => {
    setStagedFiles((prev) => {
      const copy = [...prev];
      copy[index].description = desc;
      return copy;
    });
  };

  // Convert File to base64 Data URL for evidence upload
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Transition Handlers
  const handleAccept = async () => {
    if (!actionDetail) return;
    setProcessing(true);
    setExecutionError(null);
    try {
      const updated = await acceptAction(actionDetail.id);
      setActionDetail((prev) => (prev ? { ...prev, status: updated.status } : null));
      setExecutionSuccess('Work order accepted! Click "Start Remediation" when beginning on-site work.');
      await loadActions();
    } catch (err: any) {
      setExecutionError(err.message || 'Failed to accept action.');
    } finally {
      setProcessing(false);
    }
  };

  const handleStart = async () => {
    if (!actionDetail) return;
    setProcessing(true);
    setExecutionError(null);
    try {
      const updated = await startAction(actionDetail.id);
      setActionDetail((prev) => (prev ? { ...prev, status: updated.status } : null));
      setExecutionSuccess('Work in progress! You may now upload evidence and submit for verification.');
      await loadActions();
    } catch (err: any) {
      setExecutionError(err.message || 'Failed to start action.');
    } finally {
      setProcessing(false);
    }
  };

  // Submit flow (Q3 & Q4)
  const handleSubmitWork = async () => {
    if (!actionDetail) return;
    setProcessing(true);
    setExecutionError(null);
    setExecutionSuccess(null);

    try {
      // 1. Upload any staged files first
      for (const staged of stagedFiles) {
        const fileUrl = await fileToDataUrl(staged.file);
        await uploadEvidence(actionDetail.id, {
          kind: staged.kind,
          file_url: fileUrl,
          file_size_bytes: staged.file.size,
          description: staged.description,
        });
      }

      // 2. Submit for verification
      const updated = await submitAction(actionDetail.id);
      setActionDetail((prev) => (prev ? { ...prev, status: updated.status } : null));
      setStagedFiles([]);
      setExecutionSuccess('Work successfully submitted for Mine Official verification!');
      await loadActions();
    } catch (err: any) {
      setExecutionError(err.message || 'Failed to submit work for verification.');
    } finally {
      setProcessing(false);
    }
  };

  // Validation: Check if at least 1 "after" photo exists (in uploaded or staged) and completion note is present (Q3)
  const hasAfterPhoto = useMemo(() => {
    const inUploaded = actionDetail?.evidences?.some((ev) => ev.kind === 'after');
    const inStaged = stagedFiles.some((f) => f.kind === 'after');
    return inUploaded || inStaged;
  }, [actionDetail, stagedFiles]);

  const canSubmit = useMemo(() => {
    if (!actionDetail || actionDetail.status !== 'in_progress') return false;
    return hasAfterPhoto && completionNotes.trim().length > 0;
  }, [actionDetail, hasAfterPhoto, completionNotes]);

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
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800 backdrop-blur-xl">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            Contractor Portal / Remediation Execution
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Assigned Work Orders</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Review assigned hazard remediation tasks, capture evidence, and submit proof of closure
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadActions}
            disabled={loading}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl text-zinc-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span className={loading ? 'animate-spin' : ''}>⟳</span>
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Work Orders List */}
      {loading ? (
        <div className="text-center py-20 text-zinc-400 text-sm">Loading work orders...</div>
      ) : actions.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800 text-zinc-500 text-sm">
          No corrective actions assigned at this time.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((act) => {
            const overdue = isOverdue(act.due_at, act.status);
            return (
              <div
                key={act.id}
                className={`p-5 rounded-2xl bg-zinc-900/80 border space-y-3 transition-all cursor-pointer hover:border-amber-500/60 ${
                  overdue
                    ? 'border-rose-500/50 bg-rose-950/10'
                    : act.status === 'rejected'
                    ? 'border-amber-500/50 bg-amber-950/10'
                    : 'border-zinc-800 hover:bg-zinc-900'
                }`}
                onClick={() => setSelectedActionId(act.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400">{act.code}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getPriorityBadge(act.priority)}`}>
                      {act.priority}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-zinc-800 text-zinc-300">
                      {act.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{act.title}</h3>
                <p className="text-xs text-zinc-400 line-clamp-2">{act.description}</p>

                {/* Rejection notice preview if rejected */}
                {act.status === 'rejected' && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center justify-between">
                    <span>⚠️ Rejected by Mine Official</span>
                    <span className="font-bold underline text-amber-200">View Reason →</span>
                  </div>
                )}

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <span>⏰</span>
                    <span className={overdue ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                      Due {new Date(act.due_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <button className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow transition-all">
                    Execute →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Execution Modal / Workspace (Q3 & Q4) */}
      {selectedActionId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 text-zinc-100 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            
            {/* Header */}
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="text-center py-20 text-zinc-400">Loading details...</div>
              ) : actionDetail ? (
                <>
                  {/* Status Banner Messages */}
                  {executionError && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                      {executionError}
                    </div>
                  )}

                  {executionSuccess && (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
                      {executionSuccess}
                    </div>
                  )}

                  {/* Q4 Rejection Banner: Amber banner at top with reason, round, date, and prominent Resume Work button */}
                  {actionDetail.status === 'rejected' && (
                    <div className="p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>Submission Rejected by Mine Official</span>
                        </span>
                        <span className="text-xs font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                          Submission Round {actionDetail.submission_round}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-950/80 rounded-xl border border-amber-500/30">
                        <span className="text-[10px] text-zinc-400 uppercase block mb-1">Official Rejection Reason:</span>
                        <p className="text-xs font-medium text-amber-200">
                          {actionDetail.rejection_reason || 'Evidence does not meet DGMS safety compliance threshold.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-amber-300">
                          Click <strong>Resume Work</strong> to restart on-site remediation and unlock evidence upload.
                        </span>
                        <button
                          onClick={handleStart}
                          disabled={processing}
                          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-lg shadow-amber-500/30 transition-all flex items-center gap-1.5"
                        >
                          <span>⚡</span>
                          <span>Resume Work</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* State transition triggers for Assigned / Accepted */}
                  {actionDetail.status === 'assigned' && (
                    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Work Order Assigned</h4>
                        <p className="text-xs text-zinc-400">Accept this work order to acknowledge statutory SLA timeline.</p>
                      </div>
                      <button
                        onClick={handleAccept}
                        disabled={processing}
                        className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs shadow-lg transition-all"
                      >
                        {processing ? 'Accepting...' : 'Accept Work Order'}
                      </button>
                    </div>
                  )}

                  {actionDetail.status === 'accepted' && (
                    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Work Order Accepted</h4>
                        <p className="text-xs text-zinc-400">Click below when commencing physical remediation at mine site.</p>
                      </div>
                      <button
                        onClick={handleStart}
                        disabled={processing}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg transition-all"
                      >
                        {processing ? 'Starting...' : '⚡ Start Remediation Work'}
                      </button>
                    </div>
                  )}

                  {/* Remediation Instructions */}
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Scope of Remediation & Safety Standard
                    </h4>
                    <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {actionDetail.description}
                    </p>
                    {actionDetail.safety_standards_referenced && (
                      <div className="text-xs text-amber-400/90 pt-1 font-mono">
                        Standard: {actionDetail.safety_standards_referenced}
                      </div>
                    )}
                  </div>

                  {/* Previously Uploaded Evidence */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Attached Proof of Work ({actionDetail.evidences?.length || 0})
                    </h4>

                    {actionDetail.evidences && actionDetail.evidences.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {actionDetail.evidences.map((ev) => (
                          <div key={ev.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
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
                              <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 h-28">
                                <img src={ev.file_url} alt="Proof" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="h-20 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-400">
                                📄 Document Attachment
                              </div>
                            )}

                            {ev.description && (
                              <p className="text-[11px] text-zinc-300 line-clamp-2">{ev.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                        No previous evidence attached.
                      </div>
                    )}
                  </div>

                  {/* Evidence Upload Section (Q3: Camera + File Picker side by side) */}
                  <div className={`space-y-4 p-5 rounded-2xl bg-zinc-950 border border-zinc-800 ${
                    actionDetail.status !== 'in_progress' ? 'opacity-50 pointer-events-none' : ''
                  }`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                          Upload Proof of Work (Q3)
                        </h4>
                        {currentGeo && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                            <span>📍 Geo-tagged</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Capture on-site photos (minimum 1 "AFTER" photo required for submission)
                      </p>
                    </div>

                    {/* Hidden inputs */}
                    <input
                      ref={cameraPickerRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFilesSelected(e.target.files, 'after')}
                    />
                    <input
                      ref={filePickerRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFilesSelected(e.target.files, 'after')}
                    />

                    {/* Side-by-side Camera + File Picker buttons (Q3) */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => cameraPickerRef.current?.click()}
                        className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/80 hover:bg-zinc-850 flex flex-col items-center justify-center gap-2 text-xs font-bold text-zinc-200 transition-all shadow-sm"
                      >
                        <span className="text-2xl">📷</span>
                        <span>Capture with Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => filePickerRef.current?.click()}
                        className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/80 hover:bg-zinc-850 flex flex-col items-center justify-center gap-2 text-xs font-bold text-zinc-200 transition-all shadow-sm"
                      >
                        <span className="text-2xl">📁</span>
                        <span>Upload Files / PDF</span>
                      </button>
                    </div>

                    {/* Staged files thumbnail preview list (Q3) */}
                    {stagedFiles.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-semibold text-zinc-400">
                          Selected Files for Upload ({stagedFiles.length})
                        </span>

                        <div className="space-y-2">
                          {stagedFiles.map((staged, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-3"
                            >
                              {staged.previewUrl ? (
                                <img
                                  src={staged.previewUrl}
                                  alt="preview"
                                  className="w-16 h-16 rounded-lg object-cover border border-zinc-700 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-400 flex-shrink-0">
                                  PDF
                                </div>
                              )}

                              <div className="flex-1 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-white truncate max-w-[200px]">
                                    {staged.file.name}
                                  </span>
                                  <button
                                    onClick={() => removeStagedFile(idx)}
                                    className="text-zinc-500 hover:text-rose-400 text-xs px-1"
                                  >
                                    ✕ Remove
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <select
                                    value={staged.kind}
                                    onChange={(e) => updateStagedKind(idx, e.target.value as EvidenceKind)}
                                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                  >
                                    <option value="after">AFTER (Post-Remediation)</option>
                                    <option value="before">BEFORE (Initial State)</option>
                                    <option value="document">DOCUMENT / Certificate</option>
                                  </select>

                                  <input
                                    type="text"
                                    value={staged.description}
                                    onChange={(e) => updateStagedDescription(idx, e.target.value)}
                                    placeholder="Evidence notes..."
                                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completion Notes (Mandatory for submit) */}
                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                        Completion Note & Summary *
                      </label>
                      <textarea
                        rows={3}
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        placeholder="Detail the completed repairs, tests conducted, and statutory standard compliance achieved..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer with Submit Button */}
            {actionDetail && (
              <div className="p-6 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedActionId(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-semibold"
                >
                  Close
                </button>

                {actionDetail.status === 'in_progress' && (
                  <div className="flex items-center gap-3">
                    {!hasAfterPhoto && (
                      <span className="text-[11px] text-amber-400">
                        ⚠️ Must attach at least 1 "AFTER" photo
                      </span>
                    )}
                    <button
                      onClick={handleSubmitWork}
                      disabled={!canSubmit || processing}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {processing ? (
                        <>
                          <span className="animate-spin">⟳</span>
                          <span>Uploading & Submitting...</span>
                        </>
                      ) : (
                        <span>✓ Submit Work for Verification</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
