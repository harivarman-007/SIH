import { cn } from '@/lib/utils'
import { useRef, useState, useEffect, useCallback } from 'react'
import { ClippedAreaChart } from '@/components/ui/advanced-stats-utils/charts'
import { TimelineAnimation } from '@/components/ui/advanced-stats-utils/timeline-animation'
import { RefreshCw, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { KPISummary, fetchKPIs } from '@/api/kpi'

interface AdvancedStatsProps {
  kpiData?: KPISummary | null;
  onRefresh?: () => void;
  showHazardsTable?: boolean;
}

export default function AdvancedStats({ kpiData: propKpiData, onRefresh: propOnRefresh }: AdvancedStatsProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [internalKpi, setInternalKpi] = useState<KPISummary | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const loadKpis = useCallback(async () => {
    if (propKpiData) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchKPIs();
      setInternalKpi(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch statutory KPI summary');
    } finally {
      setIsLoading(false);
    }
  }, [propKpiData]);

  useEffect(() => {
    if (!propKpiData) {
      loadKpis();
    }
  }, [loadKpis, propKpiData]);

  const kpiData = propKpiData !== undefined ? propKpiData : internalKpi;

  const handleRefresh = () => {
    if (propOnRefresh) {
      propOnRefresh();
    } else {
      loadKpis();
    }
  };

  // Map live backend KPIs to display-friendly format
  const kpis = kpiData
    ? [
        {
          label: 'Active Critical Hazards',
          value: String(kpiData.open_high_risk_count),
          change: `${kpiData.open_count + kpiData.in_progress_count + kpiData.escalated_count} open total`,
          status: kpiData.open_high_risk_count > 5 ? 'down' : 'up' as const,
        },
        {
          label: 'Mean Time to Closure',
          value: kpiData.avg_time_to_closure_hours != null
            ? `${kpiData.avg_time_to_closure_hours.toFixed(1)}h`
            : 'N/A',
          change: `${kpiData.closed_count} resolved`,
          status: 'down' as const,
        },
        {
          label: 'Mobile Sync Health',
          value: `${kpiData.sync_rate_pct.toFixed(0)}%`,
          change: `${kpiData.total_observations} total observations`,
          status: kpiData.sync_rate_pct >= 95 ? 'up' : 'down' as const,
        },
        {
          label: 'Escalated Incidents',
          value: String(kpiData.escalated_count),
          change: `${kpiData.by_risk.high} high-risk total`,
          status: kpiData.escalated_count > 0 ? 'down' : 'up' as const,
        },
      ]
    : [
        { label: 'Active Critical Hazards', value: isLoading ? '...' : '0', change: isLoading ? 'Syncing...' : 'None active', status: 'up' as const },
        { label: 'Mean Time to Closure', value: isLoading ? '...' : '0.0h', change: isLoading ? 'Syncing...' : 'Optimal', status: 'up' as const },
        { label: 'Mobile Sync Health', value: isLoading ? '...' : '100%', change: isLoading ? 'Syncing...' : 'Healthy', status: 'up' as const },
        { label: 'Escalated Incidents', value: isLoading ? '...' : '0', change: isLoading ? 'Syncing...' : 'Zero critical', status: 'up' as const },
      ]

  // Compliance score derived from closed ratio (live)
  const complianceScore = kpiData
    ? Math.min(
        100,
        Math.round(
          (kpiData.closed_count / Math.max(1, kpiData.total_observations)) * 100
        )
      )
    : 0

  return (
    <section
      ref={timelineRef}
      className="flex flex-col gap-8 py-4 bg-white justify-center"
    >
      <div className="max-w-7xl mx-auto w-full">
        {/* Refresh button & status */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-zinc-500 font-medium">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-zinc-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-900" />
                Syncing live telemetry from backend...
              </span>
            ) : error ? (
              <span className="flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="w-3.5 h-3.5" />
                Backend sync notice: {error}
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Live DGMS statutory telemetry connected
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-black transition-colors px-3 py-1.5 rounded-full border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
            Refresh KPIs
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Section */}
          <TimelineAnimation
            animationNum={1}
            timelineRef={timelineRef}
            className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs"
          >
            <ClippedAreaChart />
          </TimelineAnimation>

          {/* Breakdown Section */}
          <div>
            <div className="flex flex-col gap-4 h-full">
              <TimelineAnimation
                animationNum={2}
                timelineRef={timelineRef}
                className="p-6 rounded-2xl h-full bg-white border border-slate-200 text-slate-900 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Statutory Benchmark
                  </p>
                  <h4 className="text-lg font-bold tracking-tight text-slate-900">
                    DGMS Compliance Score
                  </h4>
                </div>
                <div className="mt-6">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                      {kpiData ? `${complianceScore}%` : '—'}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 mb-1">
                      Target: 90%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-700"
                      style={{ width: kpiData ? `${complianceScore}%` : '0%' }}
                    />
                  </div>
                  {kpiData && (
                    <p className="text-[11px] text-slate-400 mt-2 font-medium">
                      Based on {kpiData.closed_count} closed / {kpiData.total_observations} total observations
                    </p>
                  )}
                </div>
              </TimelineAnimation>

              <TimelineAnimation
                animationNum={3}
                timelineRef={timelineRef}
                className="p-6 rounded-2xl h-full bg-white border border-slate-200 shadow-xs"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="size-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <ShieldCheck className="size-4 text-blue-800" />
                  </div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Risk Breakdown</h4>
                </div>
                {kpiData ? (
                  <div className="space-y-2.5">
                    {[
                      { label: 'High Risk', count: kpiData.by_risk.high, badge: 'text-rose-700 bg-rose-50 border-rose-200' },
                      { label: 'Medium Risk', count: kpiData.by_risk.medium, badge: 'text-amber-700 bg-amber-50 border-amber-200' },
                      { label: 'Low Risk', count: kpiData.by_risk.low, badge: 'text-blue-700 bg-blue-50 border-blue-200' },
                    ].map(({ label, count, badge }) => (
                      <div key={label} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-medium">{label}</span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${badge}`}>
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Loading telemetry…</p>
                )}
              </TimelineAnimation>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          {kpis.map((kpi, index) => (
            <TimelineAnimation
              animationNum={4 + index}
              timelineRef={timelineRef}
              key={kpi.label}
              className={cn(
                'p-5 rounded-2xl border bg-white border-slate-200 shadow-xs transition-colors hover:border-slate-300'
              )}
            >
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {kpi.label}
              </p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {kpi.value}
                </p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-slate-700 bg-slate-100 border border-slate-200">
                  {kpi.change}
                </span>
              </div>
            </TimelineAnimation>
          ))}
        </div>
      </div>
    </section>
  )
}
