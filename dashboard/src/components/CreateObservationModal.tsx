import React, { useState } from 'react';
import { createObservation, ObsCategory, RiskFlag, ObservationOut } from '../api/observations';
import { AlertTriangle, X, Loader2, CheckCircle } from 'lucide-react';

interface CreateObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newObs: ObservationOut) => void;
}

export const CreateObservationModal: React.FC<CreateObservationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [category, setCategory] = useState<ObsCategory>('safety');
  const [edgeFlag, setEdgeFlag] = useState<RiskFlag>('high');
  const [description, setDescription] = useState('');
  const [gasReading, setGasReading] = useState('');
  const [photoUrl, setPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?q=80&w=800&auto=format&fit=crop'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
        photo_url: photoUrl.trim() || undefined,
        has_photo: Boolean(photoUrl.trim()),
      };

      if (gasReading) {
        payload.gas_reading_value = parseFloat(gasReading);
        payload.gas_reading_unit = '% CH4';
      }

      const res = await createObservation(payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        onClose();
        if (onSuccess) onSuccess(res);
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit observation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white text-zinc-900 w-full max-w-lg rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Log Statutory Hazard Observation</h3>
              <p className="text-[11px] text-zinc-500">DGMS Field Inspection Statutory Register</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Observation logged and broadcast to mine safety network!
            </div>
          )}

          {/* Category & Severity grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Hazard Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ObsCategory)}
                className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="safety">Safety (Strata / Machinery)</option>
                <option value="environment">Environment (Ventilation / Dust)</option>
                <option value="labour">Labour & PPE Compliance</option>
                <option value="production">Production & Transport</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Risk Severity</label>
              <select
                value={edgeFlag}
                onChange={(e) => setEdgeFlag(e.target.value as RiskFlag)}
                className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="high">High Risk (Immediate Stop)</option>
                <option value="medium">Medium Risk (24h Remedy)</option>
                <option value="low">Low Risk (Advisory)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Hazard Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Roof strata delamination noticed at junction 4-B with loose coal balls hanging."
              className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          {/* Gas Reading (Optional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Gas Reading (% CH4 / CO ppm)
              </label>
              <input
                type="number"
                step="0.01"
                value={gasReading}
                onChange={(e) => setGasReading(e.target.value)}
                placeholder="e.g. 1.25"
                className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Site Evidence Photo URL
              </label>
              <input
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="Image URL..."
                className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-black border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-black transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Recording Observation...
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
