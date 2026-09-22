import React, { useEffect, useState } from 'react';
import {
  fetchReports,
  createReport,
  exportReportCsv,
  ReportItem,
} from '../api/reports';

export const ComplianceReportsView: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await fetchReports();
      setReports(data);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to load compliance reports.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerate = async (type: string) => {
    try {
      setGenerating(type);
      setFeedback(null);
      const newReport = await createReport({ type });
      setReports((prev) => [newReport, ...prev]);
      setFeedback({
        type: 'success',
        message: `Report snapshot for '${type.replace('_', ' ').toUpperCase()}' generated successfully.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to generate report snapshot.',
      });
    } finally {
      setGenerating(null);
    }
  };

  const handleExport = async (reportId: string, type: string) => {
    try {
      setExportingId(reportId);
      await exportReportCsv(reportId, `dgms-${type}-${reportId.slice(0, 8)}.csv`);
      setFeedback({
        type: 'success',
        message: 'Report exported to CSV successfully (audited in ledger).',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to export report.',
      });
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-amber-500">
            Corporate Governance & DGMS Compliance
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Statutory Compliance Reports</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Snapshot report generation, DGMS statutory export logs & verifiable CSV records
          </p>
        </div>

        <button
          onClick={loadReports}
          className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          ⟳ Refresh Archive
        </button>
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

      {/* Generator Cards (Design Answer 3A) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Compliance Summary */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">📋</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                Statutory Summary
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-2">Compliance Overview</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Consolidated snapshot of observations, closure compliance rates, and statutory category distributions across authorized mine sites.
            </p>
          </div>

          <button
            type="button"
            disabled={generating === 'compliance_summary'}
            onClick={() => handleGenerate('compliance_summary')}
            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            {generating === 'compliance_summary' ? 'Generating…' : 'Generate Snapshot'}
          </button>
        </div>

        {/* Card 2: Violations Ledger */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">⚠️</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/60">
                High-Risk Audit
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-2">DGMS Violations Ledger</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Detailed registry of high and critical severity safety hazards, methane gas threshold breaches, and rejected corrective action items.
            </p>
          </div>

          <button
            type="button"
            disabled={generating === 'violations'}
            onClick={() => handleGenerate('violations')}
            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            {generating === 'violations' ? 'Generating…' : 'Generate Snapshot'}
          </button>
        </div>

        {/* Card 3: Contractor Remediation */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">🛠️</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/60">
                Contractor SLA
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-2">Remediation Performance</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Contractor turnaround SLA compliance, average resolution times in hours, and manager verification rejection/rework rates.
            </p>
          </div>

          <button
            type="button"
            disabled={generating === 'closure_performance'}
            onClick={() => handleGenerate('closure_performance')}
            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            {generating === 'closure_performance' ? 'Generating…' : 'Generate Snapshot'}
          </button>
        </div>
      </div>

      {/* Reports Archive Table (Design Answer 3A) */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Generated Reports Archive
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Point-in-time snapshot archives backed by immutable audit ledger records
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {reports.length} Reports Archived
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-400 text-xs">
            <span className="animate-spin mr-2">⟳</span> Loading reports archive…
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs">
            No compliance report snapshots generated yet. Use the generator cards above to create your first report.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Report ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Generated Date</th>
                  <th className="py-2.5 px-3">Scope</th>
                  <th className="py-2.5 px-3">Primary Metric</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {reports.map((r) => {
                  const typeLabels: Record<string, string> = {
                    compliance_summary: 'Compliance Overview',
                    violations: 'DGMS Violations',
                    closure_performance: 'Remediation SLA',
                  };

                  let primaryMetric = '—';
                  if (r.type === 'compliance_summary') {
                    primaryMetric = `${r.payload?.compliance_rate_pct ?? 0}% Compliance (${r.payload?.total_observations ?? 0} obs)`;
                  } else if (r.type === 'violations') {
                    primaryMetric = `${r.payload?.total_violations ?? 0} Critical Violations`;
                  } else if (r.type === 'closure_performance') {
                    primaryMetric = `${r.payload?.avg_closure_hours ?? 0}h Avg (${r.payload?.contractor_on_time_pct ?? 0}% on-time)`;
                  }

                  return (
                    <tr key={r.id} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-zinc-300 font-bold">
                        {r.id.slice(0, 8)}…
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-amber-400">
                          {typeLabels[r.type] || r.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-zinc-300">
                        {new Date(r.generated_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-zinc-400 text-[11px]">
                        {typeof r.scope?.target_mines === 'string'
                          ? r.scope.target_mines
                          : `${r.scope?.target_mines?.length || 0} Mines`}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">
                        {primaryMetric}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedReport(r)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            disabled={exportingId === r.id}
                            onClick={() => handleExport(r.id, r.type)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {exportingId === r.id ? 'Exporting…' : 'Export CSV'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Snapshot Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  {selectedReport.payload?.summary_title || 'Report Snapshot Preview'}
                </h2>
                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                  ID: {selectedReport.id} • {new Date(selectedReport.generated_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-zinc-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-[11px] whitespace-pre-wrap">
                {JSON.stringify(selectedReport.payload, null, 2)}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleExport(selectedReport.id, selectedReport.type)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
