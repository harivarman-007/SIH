import React, { useState, useEffect } from 'react';
import { createAction } from '../api/actions';
import { fetchUsers, UserInfo } from '../api/auth';
import { ActionPriority, CorrectiveAction } from '../types/actions';
import { ObservationOut, fetchObservations } from '../api/observations';

interface CreateActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  observation: ObservationOut | any | null;
  onSuccess?: (action: CorrectiveAction) => void;
}

export const CreateActionDrawer: React.FC<CreateActionDrawerProps> = ({
  isOpen,
  onClose,
  observation,
  onSuccess,
}) => {
  const [contractors, setContractors] = useState<UserInfo[]>([]);
  const [loadingContractors, setLoadingContractors] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ActionPriority>('high');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [safetyStandards, setSafetyStandards] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load contractors list
  useEffect(() => {
    if (!isOpen) return;
    setLoadingContractors(true);
    fetchUsers({ role: 'contractor' })
      .then((users) => {
        setContractors(users);
        if (users.length > 0 && !assignedToUserId) {
          setAssignedToUserId(users[0].id);
        }
      })
      .catch(() => {
        // Fallback default contractor
        setContractors([]);
      })
      .finally(() => setLoadingContractors(false));
  }, [isOpen]);

  // Prefill fields when observation changes
  useEffect(() => {
    if (!observation) return;

    // Prefill title from suggested_action or observation title / description
    const obsTitle = observation.title || observation.name || `Observation in ${observation.zone_id || 'Mine'}`;
    const suggested = observation.suggested_action || observation.suggestedAction || `Remediation for ${obsTitle}`;
    setTitle(suggested);

    const desc = observation.description
      ? `Action required: ${suggested}\n\nContext from Observation: ${observation.description}\nLocation: ${observation.location || observation.zone_id || 'Mine Zone'}`
      : `Remediate identified non-compliance in ${observation.location || observation.zone_id || 'designated sector'}.`;
    setDescription(desc);

    // Map risk level to priority
    const riskLevel = observation.risk_level || observation.severity || observation.cloud_flag || observation.edge_flag || 'medium';
    if (riskLevel === 'high') {
      setPriority('critical');
    } else if (riskLevel === 'medium') {
      setPriority('high');
    } else {
      setPriority('medium');
    }

    // Default deadline: 48 hours for critical/high, 7 days for medium/low
    const defaultHours = riskLevel === 'high' ? 24 : 72;
    const deadline = new Date(Date.now() + defaultHours * 3600 * 1000);
    // Format YYYY-MM-DDTHH:mm
    const tzOffset = deadline.getTimezoneOffset() * 60000;
    const localISOTime = new Date(deadline.getTime() - tzOffset).toISOString().slice(0, 16);
    setDueAt(localISOTime);

    setSafetyStandards('DGMS (Tech) Circular / Coal Mines Regulations 2017');
    setError(null);
    setSuccessMsg(null);
  }, [observation]);

  if (!isOpen || !observation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedToUserId) {
      setError('Please select an assigned contractor.');
      return;
    }
    if (!title.trim()) {
      setError('Action title is required.');
      return;
    }
    if (!dueAt) {
      setError('Target deadline is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let obsId = observation.id;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(obsId);
      if (!isUuid) {
        const liveObs = await fetchObservations({ limit: 1 });
        if (liveObs && liveObs.length > 0) {
          obsId = liveObs[0].id;
        } else {
          setError('Cannot create action: no live observation found in the database.');
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        observation_id: obsId,
        assigned_to_user_id: assignedToUserId,
        title: title.trim(),
        description: description.trim(),
        priority,
        due_at: new Date(dueAt).toISOString(),
        safety_standards_referenced: safetyStandards.trim() ? [safetyStandards.trim()] : undefined,
      };

      const newAction = await createAction(payload);
      setSuccessMsg(`Action ${newAction.code} created and dispatched to contractor!`);
      if (onSuccess) {
        onSuccess(newAction);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create corrective action.';
      const detailStr = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : String(msg);
      setError(detailStr);
    } finally {
      setSubmitting(false);
    }
  };

  const riskLevel = observation.risk_level || observation.severity || observation.cloud_flag || observation.edge_flag || 'medium';
  const obsTitle = observation.title || observation.name || `Observation in ${observation.zone_id || 'Mine'}`;
  const rawImage = observation.image_url || observation.photo_url || observation.photoUrl;
  const obsImage = !rawImage || rawImage.includes('1578328819058-b69f3a3b0f6b')
    ? 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?q=80&w=800&auto=format&fit=crop'
    : rawImage;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 text-zinc-100 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
              Statutory Remediation Workflow
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5">Assign Corrective Action</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Close drawer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Observation Context Preview Card (Q1: Keeps risk, photo, explanation visible) */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                OBSERVATION #{observation.id.slice(0, 8)}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                  riskLevel === 'high'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : riskLevel === 'medium'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                Risk: {riskLevel}
              </span>
            </div>

            <div>
              <h4 className="font-semibold text-white text-base">{obsTitle}</h4>
              <p className="text-xs text-zinc-400 mt-1">{observation.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-zinc-400 pt-2 border-t border-zinc-800/60">
              <div>
                <span className="text-zinc-500 block">Location / Zone:</span>
                <span className="text-zinc-200 font-medium">{observation.location || observation.zone_id || 'General Mine Area'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Suggested AI Action:</span>
                <span className="text-amber-300 font-medium">
                  {observation.suggested_action || observation.suggestedAction || 'Inspect and rectify non-compliance'}
                </span>
              </div>
            </div>

            {obsImage && (
              <div className="mt-2 rounded-lg overflow-hidden border border-zinc-800 max-h-40 bg-zinc-900">
                <img
                  src={obsImage}
                  alt="Observation proof"
                  className="w-full h-40 object-cover"
                />
              </div>
            )}
          </div>

          {/* Form */}
          <form id="create-action-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Action Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                placeholder="e.g. Replace damaged ventilation ducting in Sector 4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Assign Contractor *
                </label>
                <select
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {loadingContractors ? (
                    <option value="">Loading contractors...</option>
                  ) : contractors.length === 0 ? (
                    <option value="">No contractors found</option>
                  ) : (
                    contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.email})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Priority Level *
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ActionPriority)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="critical">CRITICAL (24h SLA)</option>
                  <option value="high">HIGH (48h SLA)</option>
                  <option value="medium">MEDIUM (72h SLA)</option>
                  <option value="low">LOW (7d SLA)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Target Deadline *
                </label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Safety Standards
                </label>
                <input
                  type="text"
                  value={safetyStandards}
                  onChange={(e) => setSafetyStandards(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="e.g. DGMS Regulation 118"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Remediation Instructions & Scope
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono text-xs leading-relaxed"
                placeholder="Detailed scope of repair, containment measures, and mandatory proof required..."
              />
            </div>
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-action-form"
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center space-x-2 transition-all"
          >
            {submitting ? (
              <>
                <span className="animate-spin">⟳</span>
                <span>Dispatching...</span>
              </>
            ) : (
              <span>⚡ Assign & Dispatch Action</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
