import React, { useEffect, useState } from 'react';
import {
  Clock,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Hash,
} from 'lucide-react';
import {
  fetchSystemSettings,
  updateSystemSettings,
  fetchSystemHealth,
  SystemSettings,
  SystemHealthData,
} from '../api/admin';

export const SystemSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [highHours, setHighHours] = useState<number>(24);
  const [mediumHours, setMediumHours] = useState<number>(72);
  const [lowHours, setLowHours] = useState<number>(168);
  const [highRisk, setHighRisk] = useState<number>(0.75);
  const [mediumRisk, setMediumRisk] = useState<number>(0.45);
  const [lowRisk, setLowRisk] = useState<number>(0.20);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sData, hData] = await Promise.all([
        fetchSystemSettings(),
        fetchSystemHealth(),
      ]);
      setSettings(sData);
      setHealth(hData);
      setHighHours(sData.sla_thresholds.high_hours);
      setMediumHours(sData.sla_thresholds.medium_hours);
      setLowHours(sData.sla_thresholds.low_hours);
      setHighRisk(sData.risk_flag_thresholds.high);
      setMediumRisk(sData.risk_flag_thresholds.medium);
      setLowRisk(sData.risk_flag_thresholds.low);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to load system settings from server.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);
      const updated = await updateSystemSettings({
        sla_thresholds: {
          high_hours: Number(highHours),
          medium_hours: Number(mediumHours),
          low_hours: Number(lowHours),
        },
        risk_flag_thresholds: {
          high: Number(highRisk),
          medium: Number(mediumRisk),
          low: Number(lowRisk),
        },
      });
      setSettings(updated);
      setFeedback({
        type: 'success',
        message: 'System governance thresholds updated successfully. Background escalation engine re-synchronized.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to update system settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400 text-xs">
        <RefreshCw className="size-4 animate-spin text-blue-700 mr-2" />
        <span>Loading system governance settings...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            System Administration / Safety Governance
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Platform Governance Settings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Operational statutory escalation SLA thresholds and AI anomaly calibration
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Scheduler: {health?.scheduler || 'Active'}
          </span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer ml-3"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Statutory SLA Thresholds */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 text-blue-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Statutory SLA Escalation Engine Thresholds (Hours)
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-4xl">
            Observations remaining unaddressed beyond these limits automatically transition to <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] border border-slate-200">escalated</code> status and trigger high-priority alerts to corporate management and DGMS regulators.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="block text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                High Severity SLA
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={720}
                  required
                  value={highHours}
                  onChange={(e) => setHighHours(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 pr-14 text-xs text-slate-900 font-mono font-bold focus:border-blue-700 focus:outline-none transition-colors shadow-2xs"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-medium text-slate-400">hours</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="block text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Medium Severity SLA
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={720}
                  required
                  value={mediumHours}
                  onChange={(e) => setMediumHours(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 pr-14 text-xs text-slate-900 font-mono font-bold focus:border-blue-700 focus:outline-none transition-colors shadow-2xs"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-medium text-slate-400">hours</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="block text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                Low Severity SLA
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={720}
                  required
                  value={lowHours}
                  onChange={(e) => setLowHours(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 pr-14 text-xs text-slate-900 font-mono font-bold focus:border-blue-700 focus:outline-none transition-colors shadow-2xs"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-medium text-slate-400">hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI & Edge Risk Flag Thresholds */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="size-4 text-blue-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              AI Anomaly Isolation Forest Risk Calibration (0.00 – 1.00)
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-4xl">
            Normalized anomaly scores from on-device Isolation Forest edge tree traversal and cloud enrichment mapping into DGMS risk buckets.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="block text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                High Risk Threshold (&gt;=)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                required
                value={highRisk}
                onChange={(e) => setHighRisk(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono font-bold focus:border-blue-700 focus:outline-none transition-colors shadow-2xs"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="block text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Medium Risk Threshold (&gt;=)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                required
                value={mediumRisk}
                onChange={(e) => setMediumRisk(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono font-bold focus:border-blue-700 focus:outline-none transition-colors shadow-2xs"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="block text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                Low Risk Baseline (&gt;=)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                required
                value={lowRisk}
                onChange={(e) => setLowRisk(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono font-bold focus:border-blue-700 focus:outline-none transition-colors shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Operational Health & Cryptographic State */}
        {health && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-emerald-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                System Operational Health & Cryptographic State
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Database</div>
                <div className="font-extrabold text-emerald-700 text-lg mt-1 capitalize">{health.database}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Observations</div>
                <div className="font-extrabold text-slate-900 font-mono text-lg mt-1">{health.entity_counts.observations}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Corrective Actions</div>
                <div className="font-extrabold text-slate-900 font-mono text-lg mt-1">{health.entity_counts.actions}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Audit Ledger Blocks</div>
                <div className="font-extrabold text-slate-900 font-mono text-lg mt-1">{health.entity_counts.audit_ledger_entries}</div>
              </div>
            </div>

            {health.audit_head?.entry_hash && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-slate-600 font-semibold flex items-center gap-2 shrink-0">
                  <Hash className="size-3.5 text-slate-400" />
                  Audit Head SHA-256:
                </span>
                <span className="font-mono text-[11px] text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 truncate max-w-xl">
                  {health.audit_head.entry_hash}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Live Wired Save Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-400">
            {settings?.updated_at
              ? `Last updated: ${new Date(settings.updated_at).toLocaleString()}`
              : 'Initial factory defaults active.'}
          </span>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="size-4" />
            <span>{saving ? 'Saving Changes…' : 'Save Governance Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
