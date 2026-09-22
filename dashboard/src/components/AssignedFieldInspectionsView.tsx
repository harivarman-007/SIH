import React, { useState, useEffect } from 'react';
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

  const getStatusBadge = (st: InspectionStatus) => {
    switch (st) {
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'in_progress':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'completed':
      case 'submitted':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'cancelled':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-500">
            Field Safety Inspector Console
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Assigned Field Inspections</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Execute scheduled underground and surface safety audits with statutory checklists
          </p>
        </div>

        <button
          onClick={loadInspections}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span className={loading ? 'animate-spin' : ''}>⟳</span>
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
          {error}
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
          {actionSuccess}
        </div>
      )}

      {/* Inspections List */}
      {loading ? (
        <div className="text-center py-20 text-zinc-400 text-sm">Loading field inspections...</div>
      ) : inspections.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800 text-zinc-500 text-sm">
          No inspections assigned to you at this time.
        </div>
      ) : (
        <div className="space-y-4">
          {inspections.map((insp) => (
            <div
              key={insp.id}
              className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 transition-all hover:border-zinc-700"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400">{insp.code}</span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(insp.status)}`}>
                    {insp.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  Scheduled: {new Date(insp.scheduled_for).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{insp.title}</h3>
                {insp.notes && <p className="text-xs text-zinc-400 mt-1">{insp.notes}</p>}
              </div>

              {/* Action Controls */}
              <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  <span>Zone: </span>
                  <span className="text-zinc-200 font-medium">{insp.zone_id || 'Sector 4 / Main Haulage'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {insp.status === 'scheduled' && (
                    <button
                      onClick={() => handleStart(insp.id)}
                      disabled={processingId === insp.id}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <span>⚡</span>
                      <span>{processingId === insp.id ? 'Starting...' : 'Begin Inspection'}</span>
                    </button>
                  )}

                  {insp.status === 'in_progress' && (
                    <button
                      onClick={() => setSubmitModalInspection(insp)}
                      disabled={processingId === insp.id}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <span>✓</span>
                      <span>Complete & Submit</span>
                    </button>
                  )}

                  {(insp.status === 'submitted' || insp.status === 'completed') && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <span>✓</span> Submitted to Manager
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase text-emerald-400">Inspection Sign-off</span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                Submit Inspection {submitModalInspection.code}
              </h2>
            </div>

            <p className="text-xs text-zinc-300">
              Certify that all mandatory check zones have been audited and all identified hazards have
              been logged into the statutory ledger.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Field Summary Notes
              </label>
              <textarea
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Overall area condition, atmospheric gas readings summary, compliance notes..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSubmitModalInspection(null)}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={processingId === submitModalInspection.id}
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs disabled:opacity-50"
              >
                {processingId === submitModalInspection.id ? 'Submitting...' : 'Sign-off & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
