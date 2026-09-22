import React, { useState, useEffect } from 'react';
import { fetchObservations, ObservationOut } from '../api/observations';

export const StatutoryEnforcementView: React.FC = () => {
  const [observations, setObservations] = useState<ObservationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchObservations({ limit: 50 })
      .then((data) => {
        // Filter observations that represent statutory non-compliances or escalations
        setObservations(data || []);
      })
      .catch((err) => setError(err.message || 'Failed to load statutory records.'))
      .finally(() => setLoading(false));
  }, []);

  const highRiskOrEscalated = observations.filter(
    (o) => o.status === 'escalated' || o.cloud_flag === 'high' || o.edge_flag === 'high'
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800 backdrop-blur-xl">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            Directorate General of Mines Safety (DGMS) / Statutory Enforcement
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Statutory Violations & Enforcement</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Immutable regulatory oversight of mine safety standards, notices, and compliance orders
          </p>
        </div>

        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-4 py-2 rounded-xl text-rose-400 font-bold text-xs">
          <span>⚠️</span>
          <span>{highRiskOrEscalated.length} High-Risk Notices Active</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Statutory Records</span>
          <div className="text-3xl font-black text-white">{observations.length}</div>
          <div className="text-[11px] text-zinc-500">Logged in cryptographic ledger</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Enforcement Orders</span>
          <div className="text-3xl font-black text-rose-400">{highRiskOrEscalated.length}</div>
          <div className="text-[11px] text-zinc-500">High-risk & escalated violations</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Auto-Escalated (SLA)</span>
          <div className="text-3xl font-black text-amber-400">
            {observations.filter((o) => o.status === 'escalated').length}
          </div>
          <div className="text-[11px] text-zinc-500">Exceeded statutory 24h/72h SLA</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Verified Closures</span>
          <div className="text-3xl font-black text-emerald-400">
            {observations.filter((o) => o.status === 'closed').length}
          </div>
          <div className="text-[11px] text-zinc-500">Certified by mine manager</div>
        </div>
      </div>

      {/* Statutory Records Table */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white">
          Active Statutory Violations & Containment Status
        </h3>

        {loading ? (
          <div className="text-center py-12 text-zinc-400 text-xs">Loading statutory records...</div>
        ) : highRiskOrEscalated.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-950 rounded-xl">
            No active high-risk statutory violations detected. All sectors operating within normal parameters.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {highRiskOrEscalated.map((obs) => (
              <div key={obs.id} className="py-4 space-y-2 first:pt-0 last:pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      OBS-{obs.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded font-bold uppercase">
                      {obs.category.toUpperCase()} &bull; {obs.cloud_flag || obs.edge_flag || 'HIGH'} RISK
                    </span>
                    {obs.status === 'escalated' && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/40 px-2 py-0.5 rounded font-bold uppercase">
                        SLA ESCALATED
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    {new Date(obs.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white">{obs.description}</h4>

                {obs.suggested_action && (
                  <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                    <strong>Mandated DGMS Directive:</strong> {obs.suggested_action}
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
