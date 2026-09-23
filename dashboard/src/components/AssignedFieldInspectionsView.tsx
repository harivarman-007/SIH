import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Calendar,
  MapPin,
  CheckCircle2,
  Play,
  ClipboardCheck,
  AlertCircle,
  X,
} from 'lucide-react';
import { fetchInspections, updateInspectionStatus } from '../api/inspections';
import { Inspection, InspectionStatus } from '../types/inspections';

export const AssignedFieldInspectionsView: React.FC = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Submit modal
  const [submitModalInspection, setSubmitModalInspection] = useState<Inspection | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');

  const loadInspections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInspections();
      setInspections(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load assigned inspections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, []);

  const handleStart = async (id: string) => {
    setProcessingId(id);
    setError(null);
    setActionSuccess(null);
    try {
      await updateInspectionStatus(id, 'in_progress');
      setActionSuccess('Inspection commenced! You can now log observations for this inspection.');
      await loadInspections();
    } catch (err: any) {
      setError(err.message || 'Failed to start inspection.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!submitModalInspection) return;
    setProcessingId(submitModalInspection.id);
    setError(null);
    try {
      await updateInspectionStatus(
        submitModalInspection.id,
        'submitted',
        completionNotes.trim() || 'Inspection completed on site.'
      );
      setSubmitModalInspection(null);
      setCompletionNotes('');
      setActionSuccess('Inspection successfully submitted for official review!');
      await loadInspections();
    } catch (err: any) {
      setError(err.message || 'Failed to submit inspection.');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (st: InspectionStatus | string) => {
    switch ((st || '').toLowerCase()) {
      case 'scheduled':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'in_progress':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'completed':
      case 'submitted':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* Header Bar */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Field Safety Inspector Console
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Assigned Field Inspections
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Execute scheduled underground and surface safety audits with statutory checklists per DGMS CMR 2017
          </p>
        </div>

        <button
          type="button"
          onClick={loadInspections}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Inspections List */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
          <RefreshCw className="size-5 animate-spin text-blue-700" />
          <span>Loading field inspections...</span>
        </div>
      ) : inspections.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm shadow-xs">
          <ClipboardCheck className="size-8 mx-auto text-slate-400 mb-2" />
          <p className="font-semibold text-slate-700">No inspections assigned at this time.</p>
          <p className="text-xs text-slate-400 mt-0.5">New audits scheduled by Mine Manager will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inspections.map((insp) => (
            <div
              key={insp.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5 transition-all hover:border-slate-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                    {insp.code}
                  </span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(insp.status)}`}>
                    {insp.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                  <Calendar className="size-3 text-slate-400" />
                  <span>
                    Scheduled: {new Date(insp.scheduled_for).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">{insp.title}</h3>
                {insp.notes && (
                  <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
                    {insp.notes}
                  </p>
                )}
              </div>

              {/* Action Controls */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                  <MapPin className="size-3.5 text-slate-400" />
                  <span>Zone: </span>
                  <span className="text-slate-800 font-semibold">{insp.zone_id || 'Sector 4 / Main Haulage'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {(insp.status || '').toLowerCase() === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() => handleStart(insp.id)}
                      disabled={processingId === insp.id}
                      className="px-3.5 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="size-3.5" />
                      <span>{processingId === insp.id ? 'Starting...' : 'Begin Inspection'}</span>
                    </button>
                  )}

                  {(insp.status || '').toLowerCase() === 'in_progress' && (
                    <button
                      type="button"
                      onClick={() => setSubmitModalInspection(insp)}
                      disabled={processingId === insp.id}
                      className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Complete & Submit</span>
                    </button>
                  )}

                  {['submitted', 'completed'].includes((insp.status || '').toLowerCase()) && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      <span>Submitted to Manager</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completion Modal */}
      {submitModalInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Inspection Sign-off
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  Submit Inspection {submitModalInspection.code}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSubmitModalInspection(null)}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Certify that all mandatory check zones have been audited and all identified hazards have
              been logged into the statutory ledger per CMR 2017 standards.
            </p>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Field Summary Notes
              </label>
              <textarea
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Overall area condition, atmospheric gas readings summary, compliance notes..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubmitModalInspection(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={processingId === submitModalInspection.id}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                <span>{processingId === submitModalInspection.id ? 'Submitting...' : 'Sign-off & Submit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
