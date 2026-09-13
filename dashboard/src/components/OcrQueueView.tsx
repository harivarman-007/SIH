import { useState, useEffect, useCallback, useRef } from 'react';
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
  ImageOff,
  User,
  Calendar,
  BarChart2,
  AlertTriangle,
} from 'lucide-react';
import { fetchOcrQueue, reviewOcrItem, OcrQueueItem } from '@/api/ocr';
import { API_BASE } from '@/api/client';

// ---------------------------------------------------------------------------
// Authenticated image loading hook
// Fetches the OCR document image using the JWT bearer token and creates a
// temporary blob URL so the <img> tag can display it without CORS issues.
// ---------------------------------------------------------------------------
function useAuthedImage(relativeUrl: string | null): {
  blobUrl: string | null;
  loading: boolean;
  error: boolean;
} {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const prevBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!relativeUrl) {
      setBlobUrl(null);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    const token = localStorage.getItem('intellifusion_token');
    fetch(`${API_BASE}${relativeUrl}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        // Revoke the old blob URL to avoid memory leaks
        if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
        prevBlobUrl.current = url;
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [relativeUrl]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    };
  }, []);

  return { blobUrl, loading, error };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO datetime string into a human-readable date. */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Derive a short display name from a submitter UUID. */
function shortSubmitter(id: string | null): string {
  if (!id) return 'Field Inspector';
  return `Inspector ···${id.slice(-6).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OcrQueueViewProps {
  role?: string;
  onRefreshCount?: () => void;
}

export default function OcrQueueView({ role, onRefreshCount }: OcrQueueViewProps) {
  const [queue, setQueue] = useState<OcrQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textValue, setTextValue] = useState<string>('');

  const canReview = role === 'mine_official' || role === 'regulator' || role === 'super_admin';

  const loadQueue = useCallback(async () => {
    if (!canReview) {
      setQueue([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const items = await fetchOcrQueue('pending');
      setQueue(items);
      if (items.length > 0) {
        setActiveId(items[0].id);
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

  const currentItem = queue.find((q) => q.id === activeId) ?? queue[0] ?? null;

  // Sync text editor when the active document changes
  useEffect(() => {
    if (currentItem) {
      setTextValue(currentItem.raw_text);
      setZoom(1);
    } else {
      setTextValue('');
    }
  }, [currentItem?.id]);

  // Load the authenticated image for the current item
  const { blobUrl: imageBlob, loading: imageLoading, error: imageError } = useAuthedImage(
    currentItem?.image_url ?? null
  );

  // -----------------------------------------------------------------------
  // Count uncertain words from the confidence_map
  // -----------------------------------------------------------------------
  const uncertainWords = currentItem
    ? Object.entries(currentItem.confidence_map || {})
        .filter(([, score]) => typeof score === 'number' && score < 0.7)
        .map(([w]) => w)
    : [];

  const handleApprove = async () => {
    if (!currentItem || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await reviewOcrItem(currentItem.id, {
        status: 'approved',
        corrected_text: textValue,
      });

      setSuccessToast('Report approved & committed to official Hazard Registry');
      onRefreshCount?.();

      const remaining = queue.filter((q) => q.id !== currentItem.id);
      setQueue(remaining);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);

      setTimeout(() => setSuccessToast(null), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      alert(`Could not approve OCR document: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!currentItem || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await reviewOcrItem(currentItem.id, { status: 'rejected' });

      setSuccessToast('Scan rejected. Inspector will be prompted to re-upload.');
      onRefreshCount?.();

      const remaining = queue.filter((q) => q.id !== currentItem.id);
      setQueue(remaining);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);

      setTimeout(() => setSuccessToast(null), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rejection failed';
      alert(`Could not reject OCR document: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Access gate
  // -----------------------------------------------------------------------
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
            Tip: Switch your role in the top right to{' '}
            <span className="font-semibold px-2 py-0.5 bg-zinc-200 rounded text-black">Mine Official</span>{' '}
            or{' '}
            <span className="font-semibold px-2 py-0.5 bg-zinc-200 rounded text-black">Regulator</span>.
          </p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------
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
                {queue.length} pending review
              </span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />}
            </div>
          </div>

          {/* Document Switcher Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadQueue}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-black hover:bg-zinc-50 transition-colors"
              title="Refresh OCR queue"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {queue.map((item, i) => {
              const isSelected = item.id === currentItem?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-black text-white border-black shadow-xs'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <FileText className="size-3.5" />
                  <span>Report #{i + 1}</span>
                  {item.status === 'approved' && (
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

      {/* Empty state */}
      {!isLoading && queue.length === 0 && !error ? (
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
      ) : currentItem ? (
        /* ----------------------------------------------------------------- */
        /* Split Workspace: Document Image on Left & Extracted Text on Right */
        /* ----------------------------------------------------------------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Real Uploaded Document Image */}
          <div className="lg:col-span-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs flex flex-col h-[580px]">
            {/* Header with Zoom Controls */}
            <div className="p-3 px-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <FileText className="size-3.5 text-zinc-500" />
                <span>Original Scanned Document</span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))}
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
                  onClick={() => setZoom((z) => Math.min(z + 0.2, 2.0))}
                  className="p-1 rounded hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="p-1 rounded hover:bg-zinc-200 text-zinc-600 transition-colors ml-1 cursor-pointer"
                  title="Reset Zoom"
                >
                  <RotateCw className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Document Image Viewer */}
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-zinc-100/60 select-none">
              {imageLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 text-zinc-400 h-full">
                  <Loader2 className="size-6 animate-spin" />
                  <span className="text-xs">Loading document image…</span>
                </div>
              ) : imageError || !imageBlob ? (
                <div className="flex flex-col items-center justify-center gap-3 text-zinc-400 h-full">
                  <ImageOff className="size-8" />
                  <span className="text-xs font-medium text-zinc-500">
                    No image on file for this document
                  </span>
                  <span className="text-[10px] text-zinc-400 text-center max-w-xs">
                    The inspector submitted this scan before image persistence was enabled. The extracted text is still available for review on the right.
                  </span>
                </div>
              ) : (
                <img
                  src={imageBlob}
                  alt="Scanned document"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out',
                    maxWidth: '100%',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
                    borderRadius: '4px',
                  }}
                />
              )}
            </div>
          </div>

          {/* RIGHT: Real Metadata + Editable Extracted Text */}
          <div className="lg:col-span-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs flex flex-col h-[580px]">
            {/* Header */}
            <div className="p-3 px-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-black" />
                <span>Digitized Report — Verify &amp; Edit</span>
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                ID: {currentItem.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {/* Main Form Fields */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Real Metadata Strip */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Document Name */}
                <div className="col-span-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5 flex items-center gap-1">
                    <FileText className="size-3 inline" /> Document Name
                  </span>
                  <span className="font-semibold text-black truncate block">
                    {currentItem.document_name || `Untitled Scan #${currentItem.id.slice(0, 6).toUpperCase()}`}
                  </span>
                </div>

                {/* Submitter */}
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5 flex items-center gap-1">
                    <User className="size-3 inline" /> Submitted By
                  </span>
                  <span className="font-semibold text-black truncate block">
                    {shortSubmitter(currentItem.submitted_by_id)}
                  </span>
                </div>

                {/* Upload Date */}
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5 flex items-center gap-1">
                    <Calendar className="size-3 inline" /> Upload Date
                  </span>
                  <span className="font-semibold text-black truncate block">
                    {formatDate(currentItem.created_at)}
                  </span>
                </div>

                {/* Overall Confidence */}
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5 flex items-center gap-1">
                    <BarChart2 className="size-3 inline" /> OCR Confidence
                  </span>
                  <span
                    className={`font-semibold truncate block ${
                      currentItem.overall_confidence >= 0.7
                        ? 'text-emerald-700'
                        : currentItem.overall_confidence >= 0.5
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }`}
                  >
                    {(currentItem.overall_confidence * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Uncertain Word Count */}
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="size-3 inline" /> Uncertain Words
                  </span>
                  <span
                    className={`font-semibold truncate block ${
                      uncertainWords.length === 0
                        ? 'text-emerald-700'
                        : uncertainWords.length <= 3
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }`}
                  >
                    {uncertainWords.length} word{uncertainWords.length !== 1 ? 's' : ''} flagged
                  </span>
                </div>
              </div>

              {/* Uncertain words list (if any) */}
              {uncertainWords.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1.5">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" /> Words with low confidence
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {uncertainWords.map((w) => (
                      <span
                        key={w}
                        className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-[10px] font-mono text-amber-900"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean Editable Extracted Text Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1">
                    <Edit2 className="size-3 text-zinc-400" />
                    <span>Extracted Observation Notes</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Click below to correct any OCR errors
                  </span>
                </div>

                <textarea
                  rows={7}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  className="w-full text-xs font-sans p-3.5 bg-zinc-50 hover:bg-zinc-50/80 focus:bg-white border border-zinc-200 focus:border-black rounded-xl focus:outline-none focus:ring-1 focus:ring-black leading-relaxed transition-colors"
                  placeholder="Observation details extracted by OCR…"
                />
              </div>

              {/* Instruction */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 flex items-start gap-2.5">
                <div className="size-1.5 rounded-full bg-black mt-1.5 shrink-0" />
                <p className="leading-relaxed">
                  Compare the scanned image on the left with the extracted text above. Correct any OCR errors, then click <strong>Approve</strong> to commit this document to the official Hazard Registry.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
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
