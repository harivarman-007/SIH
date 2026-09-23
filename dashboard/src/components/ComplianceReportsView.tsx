import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  Wrench,
  RefreshCw,
  Download,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Building2,
  FileCheck2,
  PlayCircle,
} from 'lucide-react';
import {
  fetchReports,
  createReport,
  exportReportCsv,
  exportReportPdf,
  fetchScheduledReports,
  triggerScheduledReports,
  ReportItem,
  ScheduledReportItem,
} from '../api/reports';

export const ComplianceReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'on-demand' | 'scheduled'>('on-demand');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);
  const [triggeringCycle, setTriggeringCycle] = useState<boolean>(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [onDemandData, schedData] = await Promise.all([
        fetchReports(),
        fetchScheduledReports().catch(() => []),
      ]);
      setReports(onDemandData);
      setScheduledReports(schedData);
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

  const handleExportCsv = async (reportId: string, type: string) => {
    try {
      setExportingId(reportId);
      await exportReportCsv(reportId, `dgms-${type}-${reportId.slice(0, 8)}.csv`);
      setFeedback({
        type: 'success',
        message: 'Report exported to CSV successfully (audited in cryptographic ledger).',
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

  const handleExportPdf = async (reportId: string, filename?: string) => {
    try {
      setExportingPdfId(reportId);
      await exportReportPdf(reportId, filename);
      setFeedback({
        type: 'success',
        message: 'Official statutory PDF return downloaded successfully.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to download PDF report.',
      });
    } finally {
      setExportingPdfId(null);
    }
  };

  const handleTriggerScheduled = async () => {
    try {
      setTriggeringCycle(true);
      const res = await triggerScheduledReports();
      setFeedback({
        type: 'success',
        message: `Automated weekly report cycle completed: ${res.reports_generated} new PDF returns generated.`,
      });
      await loadReports();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail?.message || 'Failed to trigger scheduled report cycle.',
      });
    } finally {
      setTriggeringCycle(false);
    }
  };

  return (
    <div className="w-full max-w-6xl space-y-5 text-slate-900">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Corporate Governance & DGMS Compliance (Item 4)
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">Statutory Compliance Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated weekly PDF returns, on-demand snapshot generation, and verifiable statutory audit records
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('on-demand')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'on-demand'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              On-Demand Snapshots
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'bg-blue-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="size-3.5" />
              <span>Scheduled Reports ({scheduledReports.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadReports}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer flex items-center shadow-2xs"
            title="Refresh records"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer ml-3"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* VIEW 1: ON-DEMAND REPORTS */}
      {activeTab === 'on-demand' && (
        <>
          {/* Generator Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Compliance Summary */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <FileSpreadsheet className="size-4.5 text-emerald-700" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Statutory Summary
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5">Compliance Overview</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Consolidated snapshot of observations, closure compliance rates, and statutory category distributions across authorized mine sites.
                </p>
              </div>

              <button
                type="button"
                disabled={generating === 'compliance_summary'}
                onClick={() => handleGenerate('compliance_summary')}
                className="w-full py-2 px-3 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5"
              >
                {generating === 'compliance_summary' ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <span>Generate Snapshot</span>
                )}
              </button>
            </div>

            {/* Card 2: Violations Ledger */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                    <AlertTriangle className="size-4.5 text-rose-700" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    High-Risk Audit
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5">DGMS Violations Ledger</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Detailed registry of high and critical severity safety hazards, environmental threshold breaches, and rejected corrective action items.
                </p>
              </div>

              <button
                type="button"
                disabled={generating === 'violations'}
                onClick={() => handleGenerate('violations')}
                className="w-full py-2 px-3 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5"
              >
                {generating === 'violations' ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <span>Generate Snapshot</span>
                )}
              </button>
            </div>

            {/* Card 3: Contractor Remediation */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <Wrench className="size-4.5 text-blue-700" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Contractor SLA
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5">Remediation Performance</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Contractor turnaround SLA compliance, average resolution times in hours, and manager verification rejection/rework rates.
                </p>
              </div>

              <button
                type="button"
                disabled={generating === 'closure_performance'}
                onClick={() => handleGenerate('closure_performance')}
                className="w-full py-2 px-3 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5"
              >
                {generating === 'closure_performance' ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <span>Generate Snapshot</span>
                )}
              </button>
            </div>
          </div>

          {/* Reports Archive Table */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Generated Reports Archive
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Point-in-time snapshot archives backed by immutable audit ledger records & formatted PDF returns
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {reports.length} Reports Archived
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="size-4 animate-spin text-blue-700" />
                <span>Loading reports archive...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 border border-slate-100 rounded-xl">
                <FileText className="size-6 text-slate-400 mx-auto mb-1.5" />
                No compliance report snapshots generated yet. Use the generator cards above to create your first report.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Report ID</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Generated Date</th>
                      <th className="py-2.5 px-3">Scope</th>
                      <th className="py-2.5 px-3">Primary Metric</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
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
                        primaryMetric = `${r.payload?.avg_closure_hours ?? 0}h Avg`;
                      }

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-mono text-blue-900 font-bold">
                            <span className="bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md text-[11px]">
                              {r.id.slice(0, 8)}…
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {typeLabels[r.type] || r.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                            {new Date(r.generated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {typeof r.scope?.target_mines === 'string'
                              ? r.scope.target_mines
                              : `${r.scope?.target_mines?.length || 0} Mines`}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {primaryMetric}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedReport(r)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Eye className="size-3" />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                disabled={exportingPdfId === r.id}
                                onClick={() => handleExportPdf(r.id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                title="Download PDF statutory return"
                              >
                                <Download className="size-3" />
                                <span>{exportingPdfId === r.id ? 'PDF…' : 'PDF'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={exportingId === r.id}
                                onClick={() => handleExportCsv(r.id, r.type)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                title="Download CSV data"
                              >
                                <Download className="size-3" />
                                <span>{exportingId === r.id ? 'CSV…' : 'CSV'}</span>
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
        </>
      )}

      {/* VIEW 2: SCHEDULED REPORTS */}
      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          {/* Scheduled Banner Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">Automated Weekly Statutory Returns</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Background daemon runs on a weekly schedule across all active mine sites, generating certified PDF compliance snapshots formatted per Mines Act 1952 and DGMS reporting standards.
              </p>
            </div>

            <button
              type="button"
              disabled={triggeringCycle}
              onClick={handleTriggerScheduled}
              className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              {triggeringCycle ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Running Weekly Cycle…</span>
                </>
              ) : (
                <>
                  <PlayCircle className="size-4" />
                  <span>Trigger Weekly Cycle Now</span>
                </>
              )}
            </button>
          </div>

          {/* Scheduled Reports List Table */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Scheduled Weekly PDF Archive
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stored on-disk in statutory PDF repository with cryptographic integrity verification
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {scheduledReports.length} Scheduled Returns Active
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="size-4 animate-spin text-blue-700" />
                <span>Loading scheduled returns...</span>
              </div>
            ) : scheduledReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 border border-slate-100 rounded-xl">
                <FileText className="size-6 text-slate-400 mx-auto mb-1.5" />
                No scheduled PDF returns generated yet. Click &quot;Trigger Weekly Cycle Now&quot; to run an automated generation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Mine / Colliery</th>
                      <th className="py-2.5 px-3">Cycle Frequency</th>
                      <th className="py-2.5 px-3">Audit Window</th>
                      <th className="py-2.5 px-3">Compliance Rate</th>
                      <th className="py-2.5 px-3">Observations</th>
                      <th className="py-2.5 px-3 text-right">PDF Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scheduledReports.slice(0, 30).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-slate-400" />
                            <span>{item.mine_name}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                            {item.filename}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {item.frequency.toUpperCase()} RETURN
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3 text-slate-400" />
                            <span>
                              {item.date_from || 'Past'} &rarr; {item.date_to || 'Present'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-bold">
                          <span
                            className={
                              item.compliance_rate_pct >= 85
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }
                          >
                            {item.compliance_rate_pct.toFixed(1)}% Compliant
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-700">
                          {item.total_observations} records
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            disabled={exportingPdfId === item.id}
                            onClick={() => handleExportPdf(item.id, item.filename)}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <Download className="size-3.5" />
                            <span>{exportingPdfId === item.id ? 'Downloading…' : 'Download PDF'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: View Report Payload */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Report Detail &mdash; {selectedReport.type.replace('_', ' ').toUpperCase()}
                </h3>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedReport.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-800">
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(selectedReport.payload, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleExportPdf(selectedReport.id)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Download PDF Return</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
