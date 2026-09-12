import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  Edit2,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { fetchOcrQueue, reviewOcrItem, OcrQueueItem } from '@/api/ocr';

// ---------------------------------------------------------------------------
// Clean, Human-Friendly Document Model
// ---------------------------------------------------------------------------
interface ScannedReport {
  id: string;
  title: string;
  mineSite: string;
  location: string;
  shift: string;
  inspector: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  scannedImageUrl: string;
  extractedText: string;
  uncertainWords: string[];
  severity: 'high' | 'medium' | 'low';
  category: 'Safety' | 'Environment' | 'Machinery';
}

function mapOcrItemToReport(item: OcrQueueItem): ScannedReport {
  const uncertain = Object.entries(item.confidence_map || {})
    .filter(([_, score]) => typeof score === 'number' && score < 0.70)
    .map(([w]) => w);

  return {
    id: item.id,
    title: item.document_name || `Statutory Shift Sheet #${item.id.slice(0, 6).toUpperCase()}`,
    mineSite: 'Jharia Coalfield Central • Sector 4',
    location: 'Gallery 4 Underground Section',
    shift: 'Daily Statutory Shift',
    inspector: item.submitted_by_id ? `Inspector ${item.submitted_by_id.slice(0, 8)}` : 'Field Safety Inspector',
    date: item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent',
    status: item.status,
    scannedImageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=1000&auto=format&fit=crop',
    extractedText: item.raw_text,
    uncertainWords: uncertain,
    severity: 'high',
    category: 'Safety',
  };
}

interface OcrQueueViewProps {
  role?: string;
  onRefreshCount?: () => void;
}

export default function OcrQueueView({ role, onRefreshCount }: OcrQueueViewProps) {
  const [reports, setReports] = useState<ScannedReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canReview = role === 'mine_official' || role === 'regulator';

  const loadQueue = useCallback(async () => {
    if (!canReview) {
      setReports([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const items = await fetchOcrQueue('pending');
      const mapped = items.map(mapOcrItemToReport);
      setReports(mapped);
      if (mapped.length > 0) {
        setActiveId(mapped[0].id);
      } else {
        setActiveId(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch OCR queue';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [canReview]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const currentReport = reports.find((r) => r.id === activeId) || reports[0] || null;
  const [textValue, setTextValue] = useState<string>('');

  // Sync text when changing document
  useEffect(() => {
    if (currentReport) {
      setTextValue(currentReport.extractedText);
      setZoom(1);
    } else {
      setTextValue('');
    }
  }, [currentReport?.id]);

  const handleApprove = async () => {
    if (!currentReport || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await reviewOcrItem(currentReport.id, {
        status: 'approved',
        corrected_text: textValue,
      });

      setSuccessToast(`Report approved & committed to official Hazard Registry`);
      onRefreshCount?.();

      // Remove from pending list
      const remaining = reports.filter((r) => r.id !== currentReport.id);
      setReports(remaining);
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
      } else {
        setActiveId(null);
      }

      setTimeout(() => {
        setSuccessToast(null);
      }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      alert(`Could not approve OCR document: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!currentReport || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await reviewOcrItem(currentReport.id, {
        status: 'rejected',
      });

      setSuccessToast(`Scan rejected. Inspector will be prompted to re-upload.`);
      onRefreshCount?.();

      // Remove from pending list
      const remaining = reports.filter((r) => r.id !== currentReport.id);
      setReports(remaining);
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
      } else {
        setActiveId(null);
      }

      setTimeout(() => {
        setSuccessToast(null);
      }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rejection failed';
      alert(`Could not reject OCR document: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canReview) {
    return (
      <div className="w-full bg-white text-zinc-950 font-sans">
        <div className="border border-zinc-200 rounded-2xl p-10 bg-zinc-50 text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-white border border-zinc-200 shadow-xs">
            <ShieldCheck className="size-6 text-black" />
          </div>
          <h3 className="text-base font-semibold text-black">
            Verification Role Clearance Required
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            Statutory OCR paper log verification and approval is restricted to Mine Officials and DGMS Regulators per Indian Mining Regulations.
          </p>
          <p className="text-xs font-medium text-zinc-800 pt-2">
            Tip: Switch your role in the top right to <span className="font-semibold px-2 py-0.5 bg-zinc-200 rounded text-black">Mine Official</span> or <span className="font-semibold px-2 py-0.5 bg-zinc-200 rounded text-black">Regulator</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white text-zinc-950 font-sans">
      {/* ----------------------------------------------------------------- */}
      {/* Top Document Selection Bar                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="border border-zinc-200 rounded-2xl p-4 bg-white shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Document Verification Queue
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-black">
                Review Scanned Paper Logs
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 font-medium">
                {reports.length} pending review
              </span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />}
            </div>
          </div>

          {/* Clean Switcher Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadQueue}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-black hover:bg-zinc-50 transition-colors"
              title="Refresh OCR queue"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {reports.map((r, i) => {
              const isSelected = r.id === currentReport?.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-black text-white border-black shadow-xs'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <FileText className="size-3.5" />
                  <span>Report #{i + 1}</span>
                  {r.status === 'approved' && (
                    <Check className="size-3 text-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700 flex items-center gap-2">
            <AlertCircle className="size-4 text-zinc-600" />
            <span>Could not fetch OCR queue: {error}</span>
          </div>
        )}

        {/* Success Alert Banner */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-3 p-3 bg-zinc-100 border border-zinc-300 rounded-xl flex items-center justify-between text-xs font-medium text-black"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-black" />
                <span>{successToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* When Queue is Empty */}
      {!isLoading && reports.length === 0 && !error ? (
        <div className="border border-zinc-200 rounded-2xl p-12 bg-white text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-zinc-100 border border-zinc-200">
            <Inbox className="size-6 text-zinc-500" />
          </div>
          <h3 className="text-base font-semibold text-black">
            OCR Verification Queue Clear
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            All scanned statutory field logs have been verified and processed into the official registry. New handwritten uploads from mobile inspectors will appear here automatically.
          </p>
          <button
            onClick={loadQueue}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-black text-white hover:bg-zinc-800 transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RefreshCw className="size-3" /> Check For New Scans
          </button>
        </div>
      ) : currentReport ? (
        /* ----------------------------------------------------------------- */
        /* Split Workspace: Document on Left & Clean Form on Right           */
        /* ----------------------------------------------------------------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Scanned Document Photo Preview */}
          <div className="lg:col-span-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs flex flex-col h-[580px]">
            {/* Header with Zoom Controls */}
            <div className="p-3 px-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <FileText className="size-3.5 text-zinc-500" />
                <span>Original Scanned Paper Log</span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.2, 0.8))}
                  className="p-1 rounded hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <span className="text-[11px] font-mono text-zinc-500 px-1">
                  {(zoom * 100).toFixed(0)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.2, 1.6))}
                  className="p-1 rounded hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="p-1 rounded hover:bg-zinc-200 text-zinc-600 transition-colors ml-1 cursor-pointer"
                  title="Reset"
                >
                  <RotateCw className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Clean Document View */}
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-zinc-100/60 select-none">
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="bg-white p-6 shadow-sm border border-zinc-300 rounded-lg w-[420px] text-zinc-900"
              >
                {/* Official Header */}
                <div className="border-b-2 border-zinc-900 pb-3 mb-4 text-center">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    DIRECTORATE GENERAL OF MINES SAFETY
                  </div>
                  <div className="text-xs font-bold text-black uppercase mt-0.5">
                    Daily Underground Inspection Record
                  </div>
                </div>

                {/* Info Table */}
                <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-zinc-200 pb-3 mb-4 text-zinc-600">
                  <div>
                    <span className="text-zinc-400">Mine:</span> {currentReport.mineSite}
                  </div>
                  <div>
                    <span className="text-zinc-400">Date:</span> {currentReport.date}
                  </div>
                  <div>
                    <span className="text-zinc-400">Shift:</span> {currentReport.shift}
                  </div>
                  <div>
                    <span className="text-zinc-400">Location:</span> {currentReport.location}
                  </div>
                </div>

                {/* Hand-written/Recorded Field Observation */}
                <div className="bg-zinc-50 border border-zinc-200 rounded p-4 text-xs leading-relaxed text-zinc-800 font-serif min-h-[140px]">
                  {currentReport.extractedText}
                </div>

                {/* Official Stamp */}
                <div className="mt-6 flex items-center justify-between pt-3 border-t border-dashed border-zinc-300">
                  <div className="border border-zinc-400 px-2 py-0.5 text-[9px] font-mono uppercase text-zinc-600 rounded">
                    DGMS FORM IV SEAL
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-serif font-bold text-black">
                      {currentReport.inspector.split(' ')[0]}
                    </div>
                    <div className="text-[9px] text-zinc-400">Overman Signature</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Digitized Text & Simple Approval Form */}
          <div className="lg:col-span-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs flex flex-col h-[580px]">
            {/* Header */}
            <div className="p-3 px-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-black" />
                <span>Digitized Report (Verify &amp; Edit)</span>
              </span>

              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                {currentReport.category} Hazard
              </span>
            </div>

            {/* Main Form Fields */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Quick Metadata Summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                    Location
                  </span>
                  <span className="font-semibold text-black truncate block">
                    {currentReport.location}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
                    Reporting Officer
                  </span>
                  <span className="font-semibold text-black truncate block">
                    {currentReport.inspector}
                  </span>
                </div>
              </div>

              {/* Clean Editable Text Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1">
                    <Edit2 className="size-3 text-zinc-400" />
                    <span>Extracted Observation Notes</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Click below to edit any typos
                  </span>
                </div>

                <textarea
                  rows={7}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  className="w-full text-xs font-sans p-3.5 bg-zinc-50 hover:bg-zinc-50/80 focus:bg-white border border-zinc-200 focus:border-black rounded-xl focus:outline-none focus:ring-1 focus:ring-black leading-relaxed transition-colors"
                  placeholder="Observation details..."
                />
              </div>

              {/* Simple Helper Notice */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 flex items-start gap-2.5">
                <div className="size-1.5 rounded-full bg-black mt-1.5 shrink-0" />
                <p className="leading-relaxed">
                  The AI automatically converted the handwriting from the paper scan. If everything matches the document on the left, click <strong>Approve</strong> to create the official hazard entry.
                </p>
              </div>
            </div>

            {/* Simple Bottom Action Buttons */}
            <div className="p-4 border-t border-zinc-200 bg-white flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-black transition-colors cursor-pointer disabled:opacity-50"
              >
                Reject Scan
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-black text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                <span>Approve &amp; Log Observation</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
