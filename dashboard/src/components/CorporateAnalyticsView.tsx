import React, { useState, useEffect } from 'react';
import { fetchCrossMineSummary, CrossMineSummary } from '../api/kpi';

export const CorporateAnalyticsView: React.FC = () => {
  const [summary, setSummary] = useState<CrossMineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchCrossMineSummary()
      .then(setSummary)
      .catch((err) => setError(err.message || 'Failed to load cross-mine analytics.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800 backdrop-blur-xl">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            Corporate Governance / Multi-Site Telemetry
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Cross-Mine Safety Analytics</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Fleet-wide comparative risk indexing, SLA escalation tracking, and contractor performance
          </p>
        </div>

        {summary && (
          <div className="flex items-center gap-3 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">
            <span className="text-xs text-zinc-400">Aggregate Fleet Risk:</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                summary.aggregate_risk_level === 'high'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : summary.aggregate_risk_level === 'medium'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {summary.aggregate_risk_score.toFixed(1)} / 100 ({summary.aggregate_risk_level})
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-zinc-400 text-sm">Loading cross-mine analytics...</div>
      ) : summary ? (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Monitored Mines</span>
              <div className="text-3xl font-black text-white">{summary.total_mines}</div>
              <div className="text-[11px] text-zinc-500">Under corporate jurisdiction</div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Open High Risk</span>
              <div className="text-3xl font-black text-rose-400">{summary.open_violations.high_risk}</div>
              <div className="text-[11px] text-zinc-500">{summary.open_violations.total} total open violations</div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Contractor Tasks</span>
              <div className="text-3xl font-black text-amber-400">{summary.contractor_risk.assigned_violations}</div>
              <div className="text-[11px] text-zinc-500">{summary.contractor_risk.active_contractors} active contractors</div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Fleet SLA Adherence</span>
              <div className="text-3xl font-black text-emerald-400">
                {summary.contractor_risk.avg_compliance_pct.toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-500">Statutory resolution speed</div>
            </div>
          </div>

          {/* Mine Risk Leaderboard & Sparklines */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Fleet Mine Risk Leaderboard & Historical Trend
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Mine Site</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Risk Index</th>
                    <th className="py-3 px-4">Open Violations</th>
                    <th className="py-3 px-4">Compliance %</th>
                    <th className="py-3 px-4">7-Day Risk Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {summary.mines_leaderboard.map((mine) => (
                    <tr key={mine.mine_id} className="hover:bg-zinc-850/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{mine.mine_name}</td>
                      <td className="py-3.5 px-4 text-zinc-400">{mine.location}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase ${
                            mine.risk_level === 'high'
                              ? 'bg-rose-500/20 text-rose-400'
                              : mine.risk_level === 'medium'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {mine.risk_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-zinc-200">
                        {mine.open_violations} ({mine.high_risk_count} High)
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        {mine.compliance_rate_pct.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4">
                        {/* 7-point trend sparkline bar */}
                        <div className="flex items-end gap-1 h-5">
                          {mine.trend_sparkline.map((val, idx) => (
                            <div
                              key={idx}
                              style={{ height: `${Math.max(15, Math.min(100, (val / 50) * 100))}%` }}
                              className={`w-2 rounded-t ${
                                val > 20 ? 'bg-rose-500' : val > 10 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              title={`Day ${idx + 1}: ${val}`}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

    </div>
  );
};
