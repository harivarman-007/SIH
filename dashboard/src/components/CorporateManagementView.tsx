import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Users,
  RefreshCw,
  ChevronRight,
  AlertOctagon,
  Filter,
} from 'lucide-react';
import { fetchCrossMineSummary, CrossMineSummary, MineLeaderboardItem } from '../api/kpi';

interface CorporateManagementViewProps {
  onRefreshKpis?: () => void;
  onSelectMine?: (mineId: string) => void;
}

const DEMO_CORPORATE_DATA: CrossMineSummary = {
  aggregate_risk_score: 72.8,
  aggregate_risk_level: 'high',
  total_mines: 3,
  total_observations: 86,
  open_violations: {
    total: 29,
    high_risk: 11,
    safety: 16,
    environment: 8,
    labour: 5,
  },
  contractor_risk: {
    active_contractors: 4,
    assigned_violations: 18,
    high_risk_contractor_tasks: 7,
    avg_compliance_pct: 82.4,
  },
  mines_leaderboard: [
    {
      mine_id: '11111111-1111-1111-1111-111111111111',
      mine_name: 'Jharia Coalfield Central',
      location: 'Dhanbad, Jharkhand',
      risk_score: 84.2,
      risk_level: 'high',
      open_violations: 14,
      high_risk_count: 7,
      total_observations: 42,
      compliance_rate_pct: 66.7,
      active_contractors: 2,
      trend_sparkline: [62.0, 68.5, 71.0, 75.2, 79.0, 81.5, 84.2],
    },
    {
      mine_id: '22222222-2222-2222-2222-222222222222',
      mine_name: 'Raniganj North Block',
      location: 'Raniganj, West Bengal',
      risk_score: 68.5,
      risk_level: 'medium',
      open_violations: 10,
      high_risk_count: 3,
      total_observations: 28,
      compliance_rate_pct: 78.6,
      active_contractors: 1,
      trend_sparkline: [76.0, 74.0, 71.5, 70.0, 68.2, 69.1, 68.5],
    },
    {
      mine_id: '33333333-3333-3333-3333-333333333333',
      mine_name: 'Korba East Mine',
      location: 'Korba, Chhattisgarh',
      risk_score: 55.6,
      risk_level: 'medium',
      open_violations: 5,
      high_risk_count: 1,
      total_observations: 16,
      compliance_rate_pct: 87.5,
      active_contractors: 1,
      trend_sparkline: [59.0, 58.0, 56.5, 57.2, 55.8, 55.0, 55.6],
    },
  ],
};

export const CorporateManagementView: React.FC<CorporateManagementViewProps> = ({
  onRefreshKpis,
  onSelectMine,
}) => {
  const [data, setData] = useState<CrossMineSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMine, setSelectedMine] = useState<MineLeaderboardItem | null>(null);
  const [sortBy, setSortBy] = useState<'risk' | 'violations' | 'compliance'>('risk');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await fetchCrossMineSummary();
      setData(summary);
      if (summary.mines_leaderboard.length > 0 && !selectedMine) {
        setSelectedMine(summary.mines_leaderboard[0]);
      }
    } catch (err: any) {
      console.warn('Backend telemetry unavailable, using enterprise demo context:', err);
      setData(DEMO_CORPORATE_DATA);
      setSelectedMine(DEMO_CORPORATE_DATA.mines_leaderboard[0]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData();
    if (onRefreshKpis) onRefreshKpis();
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high':
        return {
          badge: 'bg-rose-50 text-rose-700 border-rose-200',
          text: 'text-rose-600',
          bg: 'bg-rose-500',
          border: 'border-rose-300',
          ring: 'ring-rose-500/20',
        };
      case 'medium':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          text: 'text-amber-600',
          bg: 'bg-amber-500',
          border: 'border-amber-300',
          ring: 'ring-amber-500/20',
        };
      default:
        return {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          text: 'text-emerald-600',
          bg: 'bg-emerald-500',
          border: 'border-emerald-300',
          ring: 'ring-emerald-500/20',
        };
    }
  };

  // Render SVG Sparkline
  const renderSparkline = (points: number[], level: string) => {
    if (!points || points.length < 2) return null;
    const width = 120;
    const height = 32;
    const minVal = Math.min(...points) - 5;
    const maxVal = Math.max(...points) + 5;
    const range = maxVal - minVal || 1;

    const coords = points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * (width - 8) + 4;
      const y = height - 4 - ((val - minVal) / range) * (height - 8);
      return `${x},${y}`;
    });

    const isTrendingUp = points[points.length - 1] >= points[0];
    const strokeColor = level === 'high' ? '#e11d48' : level === 'medium' ? '#d97706' : '#059669';

    return (
      <div className="flex items-center gap-2">
        <svg width={width} height={height} className="overflow-visible">
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={coords.join(' ')}
          />
          {coords.map((pt, i) => {
            if (i === 0 || i === coords.length - 1) {
              const [cx, cy] = pt.split(',');
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r="3"
                  fill={strokeColor}
                  className={i === coords.length - 1 ? 'animate-pulse' : ''}
                />
              );
            }
            return null;
          })}
        </svg>
        <span className="text-[10px] font-mono flex items-center">
          {isTrendingUp ? (
            <TrendingUp className="w-3 h-3 text-rose-500 mr-0.5" />
          ) : (
            <TrendingDown className="w-3 h-3 text-emerald-500 mr-0.5" />
          )}
        </span>
      </div>
    );
  };

  if (isLoading && !data) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
        <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
          Aggregating cross-mine compliance telemetry…
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 rounded-2xl border border-rose-200 bg-rose-50/50 text-center my-6">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-rose-900">Failed to load corporate telemetry</h3>
        <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium hover:bg-black transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const aggregateRisk = data?.aggregate_risk_score ?? 0;
  const aggregateLevel = data?.aggregate_risk_level ?? 'low';
  const riskColors = getRiskColor(aggregateLevel);

  // Sorting logic for leaderboard
  const sortedMines = [...(data?.mines_leaderboard ?? [])].sort((a, b) => {
    if (sortBy === 'risk') return b.risk_score - a.risk_score;
    if (sortBy === 'violations') return b.open_violations - a.open_violations;
    return a.compliance_rate_pct - b.compliance_rate_pct;
  });

  return (
    <div className="space-y-8">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-zinc-900 text-white font-semibold">
              Multi-Mine Oversight
            </span>
            <span className="text-xs text-zinc-500">
              Monitoring {data?.total_mines ?? 0} granted mine sites across enterprise
            </span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 mt-1">
            Corporate Executive Intelligence
          </h2>
        </div>

        <button
          onClick={handleRefresh}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 shadow-sm transition-all"
        >
          <RefreshCw className={`w-3 h-3 text-zinc-500 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Fleet Telemetry</span>
        </button>
      </div>

      {/* 1. HEADLINE METRIC CARD WITH DRILL-DOWNS */}
      <div className="rounded-3xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50/70 to-white p-6 sm:p-8 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Main Headline Metric Display */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-zinc-200/80 pb-6 lg:pb-0 lg:pr-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                Headline Risk Indicator
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${riskColors.badge}`}>
                {aggregateLevel} risk index
              </span>
            </div>

            <div className="flex items-baseline gap-3 my-2">
              <span className="text-6xl font-bold tracking-tight text-zinc-950 font-mono">
                {aggregateRisk.toFixed(1)}
              </span>
              <span className="text-sm font-medium text-zinc-400">/ 100</span>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed mt-2">
              Composite severity across all assigned production zones, high-risk open hazards, and contractor statutory adherence.
            </p>

            {/* Visual Risk Scale Bar */}
            <div className="mt-5">
              <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                <span>0 (NOMINAL)</span>
                <span>50 (ELEVATED)</span>
                <span>100 (CRITICAL)</span>
              </div>
              <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-700 ${riskColors.bg}`}
                  style={{ width: `${Math.min(100, Math.max(5, aggregateRisk))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Drill-down Sub-panels */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Drill-down 1: Open Statutory Violations */}
            <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-800">
                    Statutory Violations
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">
                  {data?.open_violations.total ?? 0} Active
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600 flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                      Critical High Risk
                    </span>
                    <span className="font-mono font-bold text-rose-600">
                      {data?.open_violations.high_risk ?? 0}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          ((data?.open_violations.high_risk ?? 0) /
                            Math.max(1, data?.open_violations.total ?? 1)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 text-center">
                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] uppercase font-mono text-zinc-400 block">Safety</span>
                    <span className="text-sm font-bold text-zinc-900 font-mono">
                      {data?.open_violations.safety ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] uppercase font-mono text-zinc-400 block">Env</span>
                    <span className="text-sm font-bold text-zinc-900 font-mono">
                      {data?.open_violations.environment ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] uppercase font-mono text-zinc-400 block">Labour</span>
                    <span className="text-sm font-bold text-zinc-900 font-mono">
                      {data?.open_violations.labour ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drill-down 2: Contractor Risk & Performance */}
            <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs hover:border-zinc-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-800">
                    Contractor Force Risk
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">
                  {data?.contractor_risk.active_contractors ?? 0} Active Crews
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600">Assigned Open Actions:</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {data?.contractor_risk.assigned_violations ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600">High-Risk Contractor Tasks:</span>
                  <span className="font-mono font-bold text-rose-600">
                    {data?.contractor_risk.high_risk_contractor_tasks ?? 0}
                  </span>
                </div>
                
                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Contractor Compliance Adherence</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {data?.contractor_risk.avg_compliance_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${data?.contractor_risk.avg_compliance_pct ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. RANKED RISK LEADERBOARD TABLE */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-6 border-b border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-zinc-700" />
              <h3 className="text-base font-semibold text-zinc-950">
                Cross-Mine Risk Leaderboard
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ranked comparison of operating mines sorted from highest exposure to lowest.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Sort by:
            </span>
            <div className="flex p-0.5 rounded-lg bg-zinc-100 border border-zinc-200 text-xs">
              <button
                onClick={() => setSortBy('risk')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  sortBy === 'risk' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Risk Index
              </button>
              <button
                onClick={() => setSortBy('violations')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  sortBy === 'violations' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Violations
              </button>
              <button
                onClick={() => setSortBy('compliance')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  sortBy === 'compliance' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Compliance
              </button>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-6 font-medium">Rank & Mine Site</th>
                <th className="py-3 px-4 font-medium">Risk Score</th>
                <th className="py-3 px-4 font-medium">Active Violations</th>
                <th className="py-3 px-4 font-medium">Contractor Crews</th>
                <th className="py-3 px-4 font-medium">Resolution Rate</th>
                <th className="py-3 px-6 font-medium text-right">7-Period Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {sortedMines.map((mine, idx) => {
                const colors = getRiskColor(mine.risk_level);
                const isTopRisk = idx === 0 && sortBy === 'risk';

                return (
                  <tr
                    key={mine.mine_id}
                    onClick={() => {
                      setSelectedMine(mine);
                      if (onSelectMine) onSelectMine(mine.mine_id);
                    }}
                    className={`group hover:bg-zinc-50/80 cursor-pointer transition-colors ${
                      selectedMine?.mine_id === mine.mine_id ? 'bg-zinc-50/90' : ''
                    }`}
                  >
                    {/* Rank & Site Info */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                            isTopRisk
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-medium text-zinc-900 group-hover:text-black flex items-center gap-1.5">
                            {mine.mine_name}
                            {isTopRisk && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-rose-100 text-rose-700 font-bold">
                                Highest Exposure
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-400">{mine.location}</span>
                        </div>
                      </div>
                    </td>

                    {/* Risk Score */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-zinc-900">
                          {mine.risk_score.toFixed(1)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${colors.badge}`}>
                          {mine.risk_level}
                        </span>
                      </div>
                    </td>

                    {/* Active Violations */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-800">
                          {mine.open_violations}
                        </span>
                        {mine.high_risk_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-200">
                            {mine.high_risk_count} Critical
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Contractor Crews */}
                    <td className="py-4 px-4">
                      <span className="text-xs font-mono font-medium text-zinc-700">
                        {mine.active_contractors} assigned
                      </span>
                    </td>

                    {/* Resolution Rate */}
                    <td className="py-4 px-4">
                      <div className="w-28">
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-zinc-500">
                            {mine.compliance_rate_pct.toFixed(0)}%
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {mine.total_observations} obs
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-800 rounded-full"
                            style={{ width: `${mine.compliance_rate_pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Trend Sparkline */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {renderSparkline(mine.trend_sparkline, mine.risk_level)}
                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedMines.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400 text-xs">
                    No mine sites currently assigned to your corporate management account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
