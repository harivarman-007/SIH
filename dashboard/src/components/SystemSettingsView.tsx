import React, { useEffect, useState } from 'react';
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
      <div className="flex items-center justify-center p-12 text-zinc-400 text-sm">
        <span className="animate-spin mr-2">⟳</span> Loading system governance settings…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            System Administration / Safety Governance
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Platform Governance Settings</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Operational statutory escalation SLA thresholds and AI anomaly calibration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-300">
            Scheduler: {health?.scheduler || 'Active'}
          </span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-white ml-3 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Statutory SLA Thresholds */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">⏱</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Statutory SLA Escalation Engine Thresholds (Hours)
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Observations remaining unaddressed beyond these limits automatically transition to <code>escalated</code> status and trigger high-priority alerts to corporate management and DGMS regulators.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-rose-400 uppercase mb-1">
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-zinc-500">hours</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase mb-1">
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-zinc-500">hours</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-400 uppercase mb-1">
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-zinc-500">hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI & Edge Risk Flag Thresholds */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              AI Anomaly Isolation Forest Risk Calibration (0.00 – 1.00)
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Normalized anomaly scores from on-device Isolation Forest edge tree traversal and cloud enrichment mapping into DGMS risk buckets.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-rose-400 uppercase mb-1">
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase mb-1">
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-400 uppercase mb-1">
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Operational Health & Cryptographic Ledger Head */}
        {health && (
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              System Operational Health & Cryptographic State
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="text-zinc-500">Database</div>
                <div className="font-bold text-emerald-400 mt-1 capitalize">{health.database}</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="text-zinc-500">Total Observations</div>
                <div className="font-bold text-white mt-1">{health.entity_counts.observations}</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="text-zinc-500">Corrective Actions</div>
                <div className="font-bold text-white mt-1">{health.entity_counts.actions}</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="text-zinc-500">Audit Ledger Blocks</div>
                <div className="font-bold text-white mt-1">{health.entity_counts.audit_ledger_entries}</div>
              </div>
            </div>

            {health.audit_head?.entry_hash && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-zinc-400 font-medium">Audit Head SHA-256:</span>
                <span className="font-mono text-[11px] text-amber-400 bg-amber-950/30 px-2 py-1 rounded border border-amber-900/40 truncate max-w-md">
                  {health.audit_head.entry_hash}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Live Wired Save Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
          <span className="text-xs text-zinc-400">
            {settings?.updated_at
              ? `Last updated: ${new Date(settings.updated_at).toLocaleString()}`
              : 'Initial factory defaults active.'}
          </span>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving Changes…' : 'Save Governance Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
