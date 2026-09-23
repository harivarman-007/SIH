import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { fetchCrossMineSummary, CrossMineSummary } from '../api/kpi';

export const CorporateAnalyticsView: React.FC = () => {
  const [summary, setSummary] = useState<CrossMineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    fetchCrossMineSummary()
      .then(setSummary)
      .catch((err) => setError(err.message || 'Failed to load cross-mine analytics.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Corporate Governance / Multi-Site Telemetry
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Cross-Mine Safety Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fleet-wide comparative risk indexing, SLA escalation tracking, and contractor performance
          </p>
        </div>

        <div className="flex items-center gap-3">
          {summary && (
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl">
              <span className="text-xs text-slate-500 font-medium">Fleet Aggregate Risk:</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  summary.aggregate_risk_level === 'high'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : summary.aggregate_risk_level === 'medium'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {summary.aggregate_risk_score.toFixed(1)} / 100 ({summary.aggregate_risk_level})
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Refresh analytics"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="size-4 animate-spin text-blue-700" />
          <span>Loading cross-mine analytics...</span>
        </div>
      ) : summary ? (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monitored Mines</span>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">{summary.total_mines}</div>
              <div className="text-[11px] text-slate-500">Under corporate jurisdiction</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Open High Risk</span>
              <div className="text-2xl font-extrabold text-rose-700 font-mono">{summary.open_violations.high_risk}</div>
              <div className="text-[11px] text-slate-500">{summary.open_violations.total} total open violations</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Contractor Tasks</span>
              <div className="text-2xl font-extrabold text-amber-700 font-mono">{summary.contractor_risk.assigned_violations}</div>
              <div className="text-[11px] text-slate-500">{summary.contractor_risk.active_contractors} active contractors</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Fleet SLA Adherence</span>
              <div className="text-2xl font-extrabold text-emerald-700 font-mono">
                {summary.contractor_risk.avg_compliance_pct.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500">Statutory resolution speed</div>
            </div>
          </div>

          {/* Mine Risk Leaderboard & Sparklines */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Fleet Mine Risk Leaderboard & Historical Trend
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {summary.mines_leaderboard.length} Mining Sectors
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-4">Mine Site</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Risk Index</th>
                    <th className="py-3 px-4">Open Violations</th>
                    <th className="py-3 px-4">Compliance %</th>
                    <th className="py-3 px-4">7-Day Risk Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.mines_leaderboard.map((mine) => (
                    <tr key={mine.mine_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{mine.mine_name}</td>
                      <td className="py-3.5 px-4 text-slate-500">{mine.location}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                            mine.risk_level === 'high'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : mine.risk_level === 'medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {mine.risk_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {mine.open_violations} ({mine.high_risk_count} High)
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700 font-mono">
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
