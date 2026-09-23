import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Play,
  Camera,
  Upload,
  X,
  MapPin,
  AlertCircle,
  ShieldCheck,
  FileText,
} from 'lucide-react';
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

  const cameraPickerRef = useRef<HTMLInputElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);

  // Load contractor actions
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

  // Fetch individual action detail when opened in drawer
  useEffect(() => {
    if (!selectedActionId) {
      setActionDetail(null);
      setStagedFiles([]);
      setCompletionNotes('');
      setExecutionError(null);
      setExecutionSuccess(null);
      return;
    }

    const loadDetail = async () => {
      setDetailLoading(true);
      setExecutionError(null);
      try {
        const detail = await fetchAction(selectedActionId);
        setActionDetail(detail);
      } catch (err: any) {
        setExecutionError(err.message || 'Failed to load action details.');
      } finally {
        setDetailLoading(false);
      }
    };

    loadDetail();
  }, [selectedActionId]);

  // Request browser geolocation once on mount or when camera tapped
  const requestGeolocation = () => {
    if (geoPrompted) return;
    setGeoPrompted(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentGeo({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn('Geolocation not granted or unavailable:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  // State transitions: Accept
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
      setExecutionError(err.message || 'Failed to accept work order.');
    } finally {
      setProcessing(false);
    }
  };

  // State transitions: Start
  const handleStart = async () => {
    if (!actionDetail) return;
    setProcessing(true);
    setExecutionError(null);
    try {
      const updated = await startAction(actionDetail.id);
      setActionDetail((prev) => (prev ? { ...prev, status: updated.status } : null));
      setExecutionSuccess('Work order marked in progress! Remediation started.');
      await loadActions();
    } catch (err: any) {
      setExecutionError(err.message || 'Failed to start work order.');
    } finally {
      setProcessing(false);
    }
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

  // Staging files for upload (Q3)
  const handleFilesSelected = (files: FileList | null, defaultKind: EvidenceKind = 'after') => {
    if (!files || files.length === 0) return;
    requestGeolocation();

    const newStaged: StagedFile[] = [];
    Array.from(files).forEach((file) => {
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      newStaged.push({
        file,
        previewUrl,
        kind: defaultKind,
        description: '',
        geo: currentGeo || undefined,
      });
    });

    setStagedFiles((prev) => [...prev, ...newStaged]);
  };

  const removeStagedFile = (idx: number) => {
    setStagedFiles((prev) => {
      const copy = [...prev];
      if (copy[idx]?.previewUrl) {
        URL.revokeObjectURL(copy[idx].previewUrl);
      }
      copy.splice(idx, 1);
      return copy;
    });
  };

  const updateStagedKind = (idx: number, kind: EvidenceKind) => {
    setStagedFiles((prev) => {
      const copy = [...prev];
      copy[idx].kind = kind;
      return copy;
    });
  };

  const updateStagedDescription = (idx: number, desc: string) => {
    setStagedFiles((prev) => {
      const copy = [...prev];
      copy[idx].description = desc;
      return copy;
    });
  };

  // Validation: Must have at least 1 "after" photo to submit
  const hasAfterPhoto = useMemo(() => {
    return stagedFiles.some((f) => f.kind === 'after');
  }, [stagedFiles]);

  const canSubmit = hasAfterPhoto && completionNotes.trim().length > 0;

  // Submit Work for Review (Q3)
  const handleSubmitWork = async () => {
    if (!actionDetail) return;
    if (!canSubmit) {
      setExecutionError('Mandatory: Attach at least 1 "AFTER" proof photo and provide completion notes.');
      return;
    }

    setProcessing(true);
    setExecutionError(null);
    setExecutionSuccess(null);

    try {
      // 1. Upload all staged evidence files sequentially
      for (const staged of stagedFiles) {
        const fileUrl = await fileToDataUrl(staged.file);
        await uploadEvidence(actionDetail.id, {
          kind: staged.kind,
          file_url: fileUrl,
          file_size_bytes: staged.file.size,
          description: staged.description || `${staged.kind.toUpperCase()} Remediation Proof`,
        });
      }

      // 2. Submit action for official review
      const updated = await submitAction(actionDetail.id);
      setActionDetail((prev) => (prev ? { ...prev, status: updated.status } : null));
      setStagedFiles([]);
      setExecutionSuccess('Remediation work submitted successfully! Awaiting DGMS / Mine Official review.');
      await loadActions();
    } catch (err: any) {
      setExecutionError(err.message || 'Failed to submit work order for verification.');
    } finally {
      setProcessing(false);
    }
  };

  const isOverdue = (due_at: string, status: string) => {
    if (['closed', 'submitted', 'verified'].includes(status.toLowerCase())) return false;
    return new Date(due_at).getTime() < Date.now();
  };

  const getPriorityBadge = (priority: ActionPriority) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'medium':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'closed':
      case 'verified':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'in_progress':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'submitted':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'rejected':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* Executive Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Contractor Portal / Remediation Execution
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Assigned Work Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review assigned hazard remediation tasks, capture evidence, and submit proof of closure
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadActions}
            disabled={loading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Work Orders List */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
          <RefreshCw className="size-5 animate-spin text-blue-700" />
          <span>Loading work orders...</span>
        </div>
      ) : actions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm shadow-xs">
          <ShieldCheck className="size-8 mx-auto text-slate-400 mb-2" />
          <p className="font-semibold text-slate-700">No corrective actions assigned at this time.</p>
          <p className="text-xs text-slate-400 mt-0.5">New remediation work dispatched by Mine Manager will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((act) => {
            const overdue = isOverdue(act.due_at, act.status);
            const isClosed = ['closed', 'verified'].includes((act.status || '').toLowerCase());
            return (
              <div
                key={act.id}
                className={`p-5 rounded-2xl bg-white border shadow-xs space-y-3.5 transition-all cursor-pointer hover:border-slate-300 hover:shadow-sm ${
                  overdue
                    ? 'border-rose-300 bg-rose-50/20'
                    : (act.status || '').toLowerCase() === 'rejected'
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
                onClick={() => setSelectedActionId(act.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                    {act.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getPriorityBadge(act.priority)}`}>
                      {act.priority}
                    </span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(act.status)}`}>
                      {act.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{act.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{act.description}</p>

                {/* Rejection notice preview if rejected */}
                {(act.status || '').toLowerCase() === 'rejected' && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="size-3.5 text-rose-600" /> Rejected by Mine Official
                    </span>
                    <span className="font-semibold underline text-rose-800 flex items-center gap-0.5">
                      View Reason <ArrowRight className="size-3" />
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                    <Clock className="size-3.5 text-slate-400" />
                    <span className={overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                      Due {new Date(act.due_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1 shadow-2xs ${
                      isClosed
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        : 'bg-blue-800 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <span>{isClosed ? 'View Details' : 'Execute'}</span>
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Execution Drawer / Modal */}
      {selectedActionId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-2xl bg-white border-l border-slate-200 text-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                    {actionDetail?.code || 'ACTION'}
                  </span>
                  {actionDetail && (
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getPriorityBadge(actionDetail.priority)}`}>
                      {actionDetail.priority}
                    </span>
                  )}
                  {actionDetail && (
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(actionDetail.status)}`}>
                      {actionDetail.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  {actionDetail?.title || 'Loading Action...'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedActionId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-white border border-slate-200 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {detailLoading ? (
                <div className="text-center py-20 text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="size-5 animate-spin text-blue-700" />
                  <span>Loading details...</span>
                </div>
              ) : actionDetail ? (
                <>
                  {/* Status Banner Messages */}
                  {executionError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0 text-rose-600" />
                      <span>{executionError}</span>
                    </div>
                  )}

                  {executionSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      <span>{executionSuccess}</span>
                    </div>
                  )}

                  {/* Rejection Banner */}
                  {(actionDetail.status || '').toLowerCase() === 'rejected' && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-rose-700 tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="size-4 text-rose-600" />
                          <span>Submission Rejected by Mine Official</span>
                        </span>
                        <span className="text-[11px] font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                          Round {actionDetail.submission_round}
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-rose-200/80">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Official Rejection Reason:</span>
                        <p className="text-xs font-medium text-slate-800 leading-relaxed">
                          {actionDetail.rejection_reason || 'Evidence does not meet DGMS safety compliance threshold.'}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <span className="text-xs text-slate-600">
                          Click <strong>Resume Work</strong> to restart on-site remediation and unlock evidence upload.
                        </span>
                        <button
                          type="button"
                          onClick={handleStart}
                          disabled={processing}
                          className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                        >
                          <Play className="size-3.5" />
                          <span>Resume Work</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* State transition triggers for Assigned / Accepted */}
                  {(actionDetail.status || '').toLowerCase() === 'assigned' && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Work Order Assigned</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Accept this work order to acknowledge statutory SLA timeline.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAccept}
                        disabled={processing}
                        className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        {processing ? 'Accepting...' : 'Accept Work Order'}
                      </button>
                    </div>
                  )}

                  {(actionDetail.status || '').toLowerCase() === 'accepted' && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Work Order Accepted</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Click below when commencing physical remediation at mine site.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleStart}
                        disabled={processing}
                        className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                      >
                        <Play className="size-3.5" />
                        <span>{processing ? 'Starting...' : 'Start Remediation Work'}</span>
                      </button>
                    </div>
                  )}

                  {/* Remediation Instructions */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Scope of Remediation & Safety Standard
                    </h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {actionDetail.description}
                    </p>
                    {actionDetail.safety_standards_referenced && (
                      <div className="text-xs text-blue-900 pt-1 font-mono">
                        Standard: {actionDetail.safety_standards_referenced}
                      </div>
                    )}
                  </div>

                  {/* Previously Uploaded Evidence */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Attached Proof of Work ({actionDetail.evidences?.length || 0})
                    </h4>

                    {actionDetail.evidences && actionDetail.evidences.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {actionDetail.evidences.map((ev) => (
                          <div key={ev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                ev.kind === 'after'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : ev.kind === 'before'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {ev.kind}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(ev.uploaded_at).toLocaleDateString()}
                              </span>
                            </div>

                            {ev.file_url.match(/\.(jpeg|jpg|png|gif|webp)$/i) || ev.file_url.startsWith('data:image') ? (
                              <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 h-28">
                                <img src={ev.file_url} alt="Proof" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="h-20 flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono text-slate-500">
                                <FileText className="size-4 mr-1 text-slate-400" /> Document Attachment
                              </div>
                            )}

                            {ev.description && (
                              <p className="text-[11px] text-slate-600 line-clamp-2">{ev.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        No previous evidence attached.
                      </div>
                    )}
                  </div>

                  {/* Evidence Upload Section */}
                  <div className={`space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 ${
                    (actionDetail.status || '').toLowerCase() !== 'in_progress' ? 'opacity-50 pointer-events-none' : ''
                  }`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Upload Proof of Work
                        </h4>
                        {currentGeo && (
                          <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-mono">
                            <MapPin className="size-3 text-emerald-600" /> Geo-tagged
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
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

                    {/* Side-by-side Camera + File Picker buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => cameraPickerRef.current?.click()}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-slate-50 flex flex-col items-center justify-center gap-1.5 text-xs font-bold text-slate-700 transition-all shadow-2xs cursor-pointer"
                      >
                        <Camera className="size-5 text-blue-700" />
                        <span>Capture with Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => filePickerRef.current?.click()}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-slate-50 flex flex-col items-center justify-center gap-1.5 text-xs font-bold text-slate-700 transition-all shadow-2xs cursor-pointer"
                      >
                        <Upload className="size-5 text-blue-700" />
                        <span>Upload Files / PDF</span>
                      </button>
                    </div>

                    {/* Staged files thumbnail preview list */}
                    {stagedFiles.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-semibold text-slate-600">
                          Selected Files for Upload ({stagedFiles.length})
                        </span>

                        <div className="space-y-2">
                          {stagedFiles.map((staged, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-3 shadow-2xs"
                            >
                              {staged.previewUrl ? (
                                <img
                                  src={staged.previewUrl}
                                  alt="preview"
                                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-mono text-slate-400 shrink-0">
                                  PDF
                                </div>
                              )}

                              <div className="flex-1 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                                    {staged.file.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeStagedFile(idx)}
                                    className="text-slate-400 hover:text-rose-600 text-xs px-1 cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <select
                                    value={staged.kind}
                                    onChange={(e) => updateStagedKind(idx, e.target.value as EvidenceKind)}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none"
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
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none placeholder:text-slate-400"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completion Notes */}
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Completion Note & Summary *
                      </label>
                      <textarea
                        rows={3}
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        placeholder="Detail the completed repairs, tests conducted, and statutory standard compliance achieved..."
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition-colors shadow-2xs"
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer with Submit Button */}
            {actionDetail && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedActionId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                >
                  Close
                </button>

                {(actionDetail.status || '').toLowerCase() === 'in_progress' && (
                  <div className="flex items-center gap-3">
                    {!hasAfterPhoto && (
                      <span className="text-xs text-rose-600 font-medium">
                        Must attach at least 1 "AFTER" photo
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSubmitWork}
                      disabled={!canSubmit || processing}
                      className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                    >
                      {processing ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          <span>Uploading & Submitting...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          <span>Submit Work for Verification</span>
                        </>
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
