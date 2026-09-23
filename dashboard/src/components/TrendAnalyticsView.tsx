import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Building2,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Search,
} from 'lucide-react';
import {
  fetchTrendsAnalytics,
  TrendsAnalyticsResponse,
  ZoneHotspotItem,
} from '../api/analytics';

export const TrendAnalyticsView: React.FC = () => {
  const [data, setData] = useState<TrendsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWindow, setActiveWindow] = useState<'14d' | '30d' | '90d'>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTrendsAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load trend analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered zone hotspots
  const filteredHotspots = (data?.zone_hotspots || []).filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.zone_name.toLowerCase().includes(q) ||
      item.mine_name.toLowerCase().includes(q) ||
      item.zone_id.toLowerCase().includes(q)
    );
  });

  // SVG Chart rendering
  const timeSeries = data?.time_series || [];
  const chartWidth = 720;
  const chartHeight = 220;
  const padX = 40;
  const padY = 24;

  const maxVal = Math.max(
    ...timeSeries.map((d) => Math.max(d.violations_count, d.high_risk_count)),
    5
  );

  const usableWidth = chartWidth - padX * 2;
  const usableHeight = chartHeight - padY * 2;

  const points = timeSeries.map((d, i) => {
    const x =
      timeSeries.length > 1
        ? padX + (i / (timeSeries.length - 1)) * usableWidth
        : padX + usableWidth / 2;
    const yViolations = chartHeight - padY - (d.violations_count / maxVal) * usableHeight;
    const yHighRisk = chartHeight - padY - (d.high_risk_count / maxVal) * usableHeight;
    return { x, yViolations, yHighRisk, ...d };
  });

  const getCurvedPath = (key: 'yViolations' | 'yHighRisk') => {
    if (points.length === 0) return '';
    return points.reduce((acc, curr, i, arr) => {
      if (i === 0) return `M ${curr.x} ${curr[key]}`;
      const prev = arr[i - 1];
      const cx1 = prev.x + (curr.x - prev.x) / 2;
      const cy1 = prev[key];
      const cx2 = prev.x + (curr.x - prev.x) / 2;
      const cy2 = curr[key];
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr[key]}`;
    }, '');
  };

  const linePathViolations = getCurvedPath('yViolations');
  const areaPathViolations =
    points.length > 0
      ? `${linePathViolations} L ${points[points.length - 1].x} ${chartHeight - padY} L ${points[0].x} ${chartHeight - padY} Z`
      : '';

  const linePathHighRisk = getCurvedPath('yHighRisk');

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Predictive Hazard Intelligence & Statutory Audits
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Recurring Failure & Trend Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rolling multi-window zone hazard frequency analysis, repeat-offender contractor audits, and statutory SLA forecasting
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveWindow('14d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeWindow === '14d'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              14-Day Rolling
            </button>
            <button
              type="button"
              onClick={() => setActiveWindow('30d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeWindow === '30d'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30-Day Rolling
            </button>
            <button
              type="button"
              onClick={() => setActiveWindow('90d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeWindow === '90d'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              90-Day Rolling
            </button>
          </div>

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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Active Hotspots</span>
          <div className="text-2xl font-extrabold text-rose-700 font-mono">
            {data?.summary.active_hotspots ?? 0}
          </div>
          <div className="text-[11px] text-slate-500">Zones with breaches in past 30 days</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Rising Hazard Trajectory</span>
          <div className="text-2xl font-extrabold text-amber-700 font-mono">
            {data?.summary.rising_zones ?? 0}
          </div>
          <div className="text-[11px] text-slate-500">Accelerating violation rate (14d vs 30d)</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">30-Day Total Breaches</span>
          <div className="text-2xl font-extrabold text-blue-700 font-mono">
            {data?.summary.total_30d_violations ?? 0}
          </div>
          <div className="text-[11px] text-slate-500">Logged statutory & threshold incidents</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Contractors Evaluated</span>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {data?.summary.contractors_evaluated ?? 0}
          </div>
          <div className="text-[11px] text-slate-500">Under rework & rejection tracking</div>
        </div>
      </div>

      {/* Trend Timeline Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Temporal Incident Distribution
            </span>
            <h2 className="text-sm font-bold text-slate-900 mt-0.5">
              30-Day Rolling Violation & Risk Trajectory
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-700" />
              <span>Total Violations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-600" />
              <span>High Risk Only</span>
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="relative w-full overflow-x-auto">
          {timeSeries.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No observation time-series data available for the rolling period.
            </div>
          ) : (
            <div className="min-w-[640px]">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-56 overflow-visible"
              >
                <defs>
                  <linearGradient id="violationsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#1E40AF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = chartHeight - padY - ratio * usableHeight;
                  const val = Math.round(ratio * maxVal);
                  return (
                    <g key={i}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={chartWidth - padX}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={padX - 8}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="9"
                        fill="#94A3B8"
                        fontFamily="monospace"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Area under curve */}
                {areaPathViolations && (
                  <path d={areaPathViolations} fill="url(#violationsGrad)" />
                )}

                {/* Violations Line */}
                {linePathViolations && (
                  <path
                    d={linePathViolations}
                    fill="none"
                    stroke="#1E40AF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}

                {/* High Risk Line */}
                {linePathHighRisk && (
                  <path
                    d={linePathHighRisk}
                    fill="none"
                    stroke="#DC2626"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="4 3"
                  />
                )}

                {/* Data Points */}
                {points.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      y={pt.yViolations}
                      r={hoverIndex === idx ? 5 : 3.5}
                      fill="#FFFFFF"
                      stroke="#1E40AF"
                      strokeWidth="2"
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoverIndex(idx)}
                      onMouseLeave={() => setHoverIndex(null)}
                    />
                  </g>
                ))}
              </svg>

              {/* Hover Tooltip */}
              {activePoint && (
                <div
                  className="absolute pointer-events-none bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-[11px] space-y-1 transform -translate-x-1/2 -translate-y-full"
                  style={{
                    left: `${(activePoint.x / chartWidth) * 100}%`,
                    top: '20px',
                  }}
                >
                  <div className="font-semibold text-slate-300">{activePoint.date}</div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-400" />
                    <span>Total Violations: <strong>{activePoint.violations_count}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-rose-400" />
                    <span>High Risk: <strong>{activePoint.high_risk_count}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recurring Hotspots Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-rose-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recurring Zone Hotspots</h2>
              <p className="text-xs text-slate-500">
                Rolling violation counts highlighting chronic non-compliance sectors
              </p>
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by zone or mine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Zone & Colliery</th>
                <th className="py-3 px-4">14-Day Rolling</th>
                <th className="py-3 px-4">30-Day Rolling</th>
                <th className="py-3 px-4">90-Day Rolling</th>
                <th className="py-3 px-4">Lifetime Total</th>
                <th className="py-3 px-4">Trend Velocity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-blue-700" />
                    Calculating recurring hazard trends...
                  </td>
                </tr>
              ) : filteredHotspots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No recurring hotspots found matching the active criteria.
                  </td>
                </tr>
              ) : (
                filteredHotspots.slice(0, 20).map((zone: ZoneHotspotItem) => (
                  <tr key={zone.zone_id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{zone.zone_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Building2 className="size-3" />
                        <span>{zone.mine_name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {zone.count_14d > 0 ? (
                        <span className="text-rose-700 font-extrabold">{zone.count_14d}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {zone.count_30d > 0 ? (
                        <span className="text-amber-700 font-extrabold">{zone.count_30d}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700">
                      {zone.count_90d}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700">
                      {zone.total_violations}
                    </td>

                    <td className="py-3 px-4">
                      {zone.recent_trend === 'rising' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          <ArrowUpRight className="size-3 text-rose-600" />
                          Rising
                        </span>
                      ) : zone.recent_trend === 'declining' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowDownRight className="size-3 text-emerald-600" />
                          Declining
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          <Minus className="size-3 text-slate-500" />
                          Stable
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contractor Repeat-Offender Rankings Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Contractor Re-work & Remediation Failures</h2>
              <p className="text-xs text-slate-500">
                Statutory audit of rejected corrective actions and rework rates per contractor
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Contractor Name</th>
                <th className="py-3 px-4">Rejected (14d)</th>
                <th className="py-3 px-4">Rejected (30d)</th>
                <th className="py-3 px-4">Rejected (90d)</th>
                <th className="py-3 px-4">Total Tasks Assigned</th>
                <th className="py-3 px-4">Rework Failure Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading contractor rework metrics...
                  </td>
                </tr>
              ) : (data?.contractor_rankings || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No rejected corrective actions logged across evaluated contractors.
                  </td>
                </tr>
              ) : (
                data?.contractor_rankings.map((c) => (
                  <tr key={c.contractor_id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{c.contractor_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">ID: {c.contractor_id.slice(0, 8)}</div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold">
                      {c.rejected_count_14d > 0 ? (
                        <span className="text-rose-700">{c.rejected_count_14d}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold">
                      {c.rejected_count_30d > 0 ? (
                        <span className="text-rose-700">{c.rejected_count_30d}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700">
                      {c.rejected_count_90d}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700">
                      {c.total_assigned}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold ${
                            c.rework_rate_pct > 25
                              ? 'text-rose-700'
                              : c.rework_rate_pct > 10
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {c.rework_rate_pct.toFixed(1)}%
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                            c.rework_rate_pct > 25
                              ? 'bg-rose-100 text-rose-800'
                              : c.rework_rate_pct > 10
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {c.rework_rate_pct > 25 ? 'High Risk' : c.rework_rate_pct > 10 ? 'Moderate' : 'Acceptable'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
