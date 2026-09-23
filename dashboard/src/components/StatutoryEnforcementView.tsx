import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { fetchObservations, ObservationOut } from '../api/observations';

export const StatutoryEnforcementView: React.FC = () => {
  const [observations, setObservations] = useState<ObservationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    fetchObservations({ limit: 50 })
      .then((data) => {
        setObservations(data || []);
      })
      .catch((err) => setError(err.message || 'Failed to load statutory records.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const highRiskOrEscalated = observations.filter(
    (o) => o.status === 'escalated' || o.cloud_flag === 'high' || o.edge_flag === 'high'
  );

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Directorate General of Mines Safety (DGMS) / Statutory Enforcement
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Statutory Violations & Enforcement</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable regulatory oversight of mine safety standards, notices, and compliance orders per CMR 2017
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-xl text-rose-700 font-semibold text-xs shadow-2xs">
            <AlertTriangle className="size-4 text-rose-600 shrink-0" />
            <span>{highRiskOrEscalated.length} High-Risk Notices Active</span>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Refresh records"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Statutory Records</span>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">{observations.length}</div>
          <div className="text-[11px] text-slate-500">Logged in cryptographic ledger</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Enforcement Orders</span>
          <div className="text-2xl font-extrabold text-rose-700 font-mono">{highRiskOrEscalated.length}</div>
          <div className="text-[11px] text-slate-500">High-risk & escalated violations</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Auto-Escalated (SLA)</span>
          <div className="text-2xl font-extrabold text-amber-700 font-mono">
            {observations.filter((o) => o.status === 'escalated').length}
          </div>
          <div className="text-[11px] text-slate-500">Exceeded statutory 24h/72h SLA</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Verified Closures</span>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono">
            {observations.filter((o) => o.status === 'closed').length}
          </div>
          <div className="text-[11px] text-slate-500">Certified by mine manager</div>
        </div>
      </div>

      {/* Statutory Records Table */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Active Statutory Violations & Containment Status
          </h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {highRiskOrEscalated.length} Cases
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="size-4 animate-spin text-blue-700" />
            <span>Loading statutory records...</span>
          </div>
        ) : highRiskOrEscalated.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 border border-slate-100 rounded-xl">
            <ShieldCheck className="size-6 text-emerald-600 mx-auto mb-1.5" />
            <p className="font-semibold text-slate-700">No active high-risk statutory violations detected.</p>
            <p className="text-slate-400 mt-0.5">All coalfield sectors operating within CMR 2017 regulatory parameters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {highRiskOrEscalated.map((obs) => (
              <div key={obs.id} className="py-4 space-y-2 first:pt-0 last:pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      OBS-{obs.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-bold uppercase">
                      {obs.category.toUpperCase()} &bull; {obs.cloud_flag || obs.edge_flag || 'HIGH'} RISK
                    </span>
                    {obs.status === 'escalated' && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold uppercase">
                        SLA ESCALATED
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="size-3 text-slate-400" />
                    {new Date(obs.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{obs.description}</h4>

                {obs.suggested_action && (
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-xl leading-relaxed">
                    <strong className="text-slate-900 font-semibold">Mandated DGMS Directive:</strong> {obs.suggested_action}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
