import { cn } from '@/lib/utils'
import { useRef } from 'react'
import { ClippedAreaChart } from '@/components/ui/advanced-stats-utils/charts'
import { TimelineAnimation } from '@/components/ui/advanced-stats-utils/timeline-animation'
import { RefreshCw } from 'lucide-react'
import { KPISummary } from '@/api/kpi'

interface AdvancedStatsProps {
  kpiData?: KPISummary | null;
  onRefresh?: () => void;
}

export default function AdvancedStats({ kpiData, onRefresh }: AdvancedStatsProps) {
  const timelineRef = useRef<HTMLDivElement>(null)

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
        { label: 'Active Critical Hazards', value: '—', change: 'Loading…', status: 'up' as const },
        { label: 'Mean Time to Closure', value: '—', change: 'Loading…', status: 'up' as const },
        { label: 'Mobile Sync Health', value: '—', change: 'Loading…', status: 'up' as const },
        { label: 'Escalated Incidents', value: '—', change: 'Loading…', status: 'up' as const },
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
        {/* Refresh button */}
        {onRefresh && (
          <div className="flex justify-end mb-4">
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-black transition-colors px-3 py-1.5 rounded-full border border-zinc-200 hover:bg-zinc-50"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh KPIs
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Section */}
          <TimelineAnimation
            animationNum={1}
            timelineRef={timelineRef}
            className="lg:col-span-2 p-8 rounded-3xl bg-zinc-50 border border-zinc-200"
          >
            <ClippedAreaChart />
          </TimelineAnimation>

          {/* Breakdown Section */}
          <div>
            <div className="flex flex-col gap-4 h-full">
              <TimelineAnimation
                animationNum={2}
                timelineRef={timelineRef}
                className="p-6 rounded-3xl h-full bg-zinc-900 text-white flex flex-col justify-between shadow-lg"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">
                    Statutory Benchmark
                  </p>
                  <h4 className="text-xl font-bold tracking-tight">
                    DGMS Compliance Score
                  </h4>
                </div>
                <div className="mt-8">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-3xl font-semibold tracking-tighter">
                      {kpiData ? `${complianceScore}%` : '—'}
                    </span>
                    <span className="text-xs font-medium text-zinc-400 mb-1">
                      Target: 90%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-700"
                      style={{ width: kpiData ? `${complianceScore}%` : '0%' }}
                    />
                  </div>
                  {kpiData && (
                    <p className="text-[10px] text-zinc-500 mt-2">
                      Based on {kpiData.closed_count} closed / {kpiData.total_observations} total observations
                    </p>
                  )}
                </div>
              </TimelineAnimation>

              <TimelineAnimation
                animationNum={3}
                timelineRef={timelineRef}
                className="p-6 rounded-3xl h-full bg-zinc-50 border border-zinc-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-8 rounded-lg bg-zinc-50 flex items-center justify-center border border-zinc-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="w-5 h-5 text-black"
                      fill="none"
                      stroke="#000000"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-zinc-900">Risk Breakdown</h4>
                </div>
                {kpiData ? (
                  <div className="space-y-2">
                    {[
                      { label: 'High Risk', count: kpiData.by_risk.high },
                      { label: 'Medium Risk', count: kpiData.by_risk.medium },
                      { label: 'Low Risk', count: kpiData.by_risk.low },
                    ].map(({ label, count }) => (
                      <div key={label} className="flex justify-between items-center text-sm">
                        <span className="text-zinc-600">{label}</span>
                        <span className="font-semibold text-zinc-900">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Loading…</p>
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
                'p-6 rounded-2xl border bg-zinc-50 border-zinc-200 transition-colors hover:border-zinc-400 hover:bg-zinc-100'
              )}
            >
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                {kpi.label}
              </p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-black text-zinc-900 tracking-tighter">
                  {kpi.value}
                </p>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded text-zinc-900 bg-zinc-200">
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
