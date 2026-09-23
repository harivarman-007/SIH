import React, { useState } from 'react';
import { createObservation, ObsCategory, RiskFlag, ObservationOut } from '../api/observations';
import { AlertTriangle, X, Loader2, CheckCircle, ShieldAlert } from 'lucide-react';

interface CreateObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newObs: ObservationOut) => void;
}

const CATEGORIES: { value: ObsCategory; label: string; icon: string }[] = [
  { value: 'safety',      label: 'Safety (Strata / Machinery)', icon: '⚠️' },
  { value: 'environment', label: 'Environment (Ventilation / Dust)', icon: '🌫️' },
  { value: 'labour',      label: 'Labour & PPE Compliance', icon: '👷' },
  { value: 'production',  label: 'Production & Transport', icon: '🚛' },
];

const RISK_LEVELS: { value: RiskFlag; label: string; color: string }[] = [
  { value: 'high',   label: 'High Risk — Immediate Stop Work', color: 'bg-red-50 border-red-300 text-red-700' },
  { value: 'medium', label: 'Medium Risk — 24h Remedy Required', color: 'bg-amber-50 border-amber-300 text-amber-700' },
  { value: 'low',    label: 'Low Risk — Advisory', color: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
];

export const CreateObservationModal: React.FC<CreateObservationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [category, setCategory] = useState<ObsCategory>('safety');
  const [edgeFlag, setEdgeFlag] = useState<RiskFlag>('high');
  const [description, setDescription] = useState('');
  const [gasReading, setGasReading] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const getInitialObservedAt = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  };
  const [observedAt, setObservedAt] = useState<string>(getInitialObservedAt);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Hazard description is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        category,
        description: description.trim(),
        edge_flag: edgeFlag,
        edge_score: edgeFlag === 'high' ? 0.92 : edgeFlag === 'medium' ? 0.65 : 0.32,
      };

      if (observedAt) {
        payload.created_at = new Date(observedAt).toISOString();
      }

      if (gasReading) {
        payload.gas_reading_value = parseFloat(gasReading);
        payload.gas_reading_unit = '% CH4';
      }

      const res = await createObservation(payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        setGasReading('');
        setObservedAt(getInitialObservedAt());
        onClose();
        if (onSuccess) onSuccess(res);
      }, 1200);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to submit observation.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setDescription('');
    setGasReading('');
    setObservedAt(getInitialObservedAt());
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white text-zinc-900 w-full max-w-lg rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Log Statutory Hazard</h3>
              <p className="text-[11px] text-zinc-400">DGMS Field Inspection Register</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Hazard logged and broadcast to mine safety network!
            </div>
          )}

          {/* Hazard Category */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2 uppercase tracking-wide">
              Hazard Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    category === cat.value
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-400'
                  }`}
                >
                  <span className="mr-1.5">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Risk Severity */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2 uppercase tracking-wide">
              Risk Severity
            </label>
            <div className="space-y-1.5">
              {RISK_LEVELS.map((risk) => (
                <button
                  key={risk.value}
                  type="button"
                  onClick={() => setEdgeFlag(risk.value)}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                    edgeFlag === risk.value
                      ? risk.color + ' ring-2 ring-offset-1 ring-current'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-zinc-300'
                  }`}
                >
                  {risk.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">
              Hazard Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Roof strata delamination at junction 4-B, loose coal visible overhead. Immediate shoring required."
              className="w-full text-xs px-3 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
            />
          </div>

          {/* Gas Reading (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5 uppercase tracking-wide">
              Gas Reading <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={gasReading}
                onChange={(e) => setGasReading(e.target.value)}
                placeholder="e.g. 1.25"
                className="w-full text-xs px-3 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-mono">% CH4</span>
            </div>
          </div>

          {/* Statutory Timestamp Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                Observation Date &amp; Time
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const tzOffset = now.getTimezoneOffset() * 60000;
                    setObservedAt(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16));
                  }}
                  className="text-[10px] font-medium text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                >
                  Set to Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const past = new Date(Date.now() - 8 * 3600 * 1000);
                    const tzOffset = past.getTimezoneOffset() * 60000;
                    setObservedAt(new Date(past.getTime() - tzOffset).toISOString().slice(0, 16));
                  }}
                  className="text-[10px] font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 transition-colors"
                >
                  Prior Shift (-8h)
                </button>
              </div>
            </div>
            <input
              type="datetime-local"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
            />
          </div>

          {/* Actions */}
          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-black border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || success}
              className="px-5 py-2 text-xs font-bold bg-zinc-900 text-white rounded-xl hover:bg-black transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Recording...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Logged!
                </>
              ) : (
                'Submit Observation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
