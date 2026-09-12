import { cn } from '@/lib/utils'
import React, { useRef } from 'react'
import { ClippedAreaChart } from '@/components/ui/advanced-stats-utils/charts'
import { TimelineAnimation } from '@/components/ui/advanced-stats-utils/timeline-animation'

interface KpiItem {
  label: string
  value: string
  change: string
  status: 'up' | 'down'
}

interface AdvancedStatsProps {
  kpis?: KpiItem[]
}

const defaultKpis: KpiItem[] = [
  { label: 'Active Critical Hazards', value: '3', change: '-2 today', status: 'down' },
  { label: 'Mean Time to Closure', value: '18.4h', change: '-14.2%', status: 'down' },
  { label: 'Mobile Sync Health', value: '100%', change: '0 pending', status: 'up' },
  { label: 'Audit Chain Integrity', value: 'Valid', change: '206 blocks', status: 'up' },
]

export default function AdvancedStats({ kpis = defaultKpis }: AdvancedStatsProps) {
  const timelineRef = useRef<HTMLDivElement>(null)

  return (
    <section
      ref={timelineRef}
      className="flex flex-col gap-8 py-4 bg-white justify-center"
    >
      <div className="max-w-7xl mx-auto w-full">
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
                      82%
                    </span>
                    <span className="text-xs font-medium text-zinc-400 mb-1">
                      Target: 90%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-white w-[82%] rounded-full" />
                  </div>
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
                  <h4 className="font-bold text-zinc-900">Incident Prevention</h4>
                </div>
                <p className="text-sm text-zinc-600">
                  Total high-risk anomalies are down{' '}
                  <span className="text-zinc-900 font-semibold">24%</span>{' '}
                  compared to previous quarter.
                </p>
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
                'p-6 rounded-2xl border bg-zinc-50 border-zinc-200 transition-colors',
                kpi.status === 'up'
                  ? 'hover:border-zinc-400 hover:bg-zinc-100'
                  : 'hover:border-zinc-400 hover:bg-zinc-100'
              )}
            >
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
                {kpi.label}
              </p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-black text-zinc-900 tracking-tighter">
                  {kpi.value}
                </p>
                <span
                  className={cn(
                    'text-xs font-bold px-1.5 py-0.5 rounded',
                    kpi.status === 'up'
                      ? 'text-zinc-900 bg-zinc-200'
                      : 'text-zinc-900 bg-zinc-200'
                  )}
                >
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
