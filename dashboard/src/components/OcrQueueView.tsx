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
  AlertTriangle,
  Upload,
  X,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { fetchOcrQueue, reviewOcrItem, submitOcrDocument, OcrQueueItem, OcrSubmitResponse } from '@/api/ocr';
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

  return { blobUrl, loading, error };
}

// Format confidence percentage safely
function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined || isNaN(confidence)) return '0.0%';
  const val = confidence > 1 ? confidence : confidence * 100;
  return `${val.toFixed(1)}%`;
}

// Mask reviewer / submitted UUID into human identifier
function maskInspector(id: string | null | undefined): string {
  if (!id) return 'Field Safety Inspector';
  return `Inspector ···${id.slice(-6).toUpperCase()}`;
}

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
  const [rotation, setRotation] = useState<number>(0);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textValue, setTextValue] = useState<string>('');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadLang, setUploadLang] = useState('eng');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setRotation(0);
    } else {
      setTextValue('');
    }
  }, [currentItem?.id]);

  // Load the authenticated image for the current item
  const { blobUrl: imageBlob, loading: imageLoading, error: imageError } = useAuthedImage(
    currentItem?.image_url ?? null
  );

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

  // Generate an authentic DGMS Form IV Ventilation & Gas Report as canvas image
  const handleLoadSampleDocument = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1100;
    canvas.height = 1450;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Vintage paper background
    ctx.fillStyle = '#f8f7f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer double border
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(35, 35, 1030, 1380);
    ctx.lineWidth = 1;
    ctx.strokeRect(42, 42, 1016, 1366);

    // Header
    ctx.fillStyle = '#0a0a0a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px serif';
    ctx.fillText('DIRECTORATE GENERAL OF MINES SAFETY (DGMS)', 550, 95);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('STATUTORY PRE-SHIFT VENTILATION & GAS INSPECTION REGISTER', 550, 135);
    ctx.font = 'italic 15px serif';
    ctx.fillText('[Under Regulation 113, Coal Mines Regulations (CMR) 2017]', 550, 165);

    // Dividing rule
    ctx.beginPath();
    ctx.moveTo(60, 190);
    ctx.lineTo(1040, 190);
    ctx.stroke();

    // Meta details
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('MINE NAME  : MOONIDIH UNDERGROUND COLLIERY (BCCL)', 70, 235);
    ctx.fillText('SEAM / PIT : SEAM XVI (LONGWALL PANEL 4-B)', 620, 235);
    ctx.fillText('INSPECTION : 22/09/2026 | 1st SHIFT (06:00 - 14:00)', 70, 275);
    ctx.fillText('OVERMAN    : VIKRAM SINGH (CERT: OV-449102)', 620, 275);

    // Table Header
    ctx.strokeRect(60, 315, 980, 50);
    ctx.fillStyle = '#e5e3dc';
    ctx.fillRect(61, 316, 978, 48);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('SAMPLING LOCATION', 80, 347);
    ctx.fillText('CH4 (%)', 440, 347);
    ctx.fillText('CO (PPM)', 580, 347);
    ctx.fillText('VELOCITY', 720, 347);
    ctx.fillText('ACTION', 880, 347);

    // Data rows
    const rows = [
      ['Main Intake Airway Split 1', '0.08 %', '0 ppm', '2.4 m/s', 'COMPLIANT'],
      ['Tailgate Return Airway 4-B', '1.65 %', '18 ppm', '1.1 m/s', 'STOP WORK'],
      ['Longwall Shearer Face 4-B', '1.12 %', '12 ppm', '1.6 m/s', 'ALERT'],
      ['Methane Degasification Sump', '0.45 %', '2 ppm', '1.9 m/s', 'COMPLIANT'],
      ['Shaft No. 2 Upcast Exhaust', '0.72 %', '6 ppm', '3.8 m/s', 'COMPLIANT'],
    ];

    let y = 405;
    rows.forEach((r) => {
      ctx.strokeStyle = '#cccccc';
      ctx.strokeRect(60, y - 28, 980, 48);
      ctx.font = '15px monospace';
      ctx.fillStyle = r[4] === 'STOP WORK' ? '#a00' : '#111';
      ctx.fillText(r[0], 80, y);
      ctx.fillText(r[1], 450, y);
      ctx.fillText(r[2], 595, y);
      ctx.fillText(r[3], 735, y);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(r[4], 885, y);
      y += 52;
    });

    // Statutory Remarks Box
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(60, 690, 980, 340);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('MANDATED STATUTORY REMARKS & REMEDIATION DIRECTIVES:', 80, 725);

    ctx.font = '16px serif';
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText('1. Critical gas buildup: Methane >1.25% at Tailgate 4-B. Power cut initiated immediately.', 80, 765);
    ctx.fillText('2. CMR Regulation 113(4) invoked: No work permitted until ventilation ducting restored.', 80, 805);
    ctx.fillText('3. Auxiliary blower fan motor overheated. Work order dispatched to electrical contractor.', 80, 845);
    ctx.fillText('4. Gas cleared verification required by Colliery Manager before 2nd shift descent.', 80, 885);

    // Signatures
    ctx.font = 'italic 17px serif';
    ctx.fillText('Signed: Vikram Singh (Statutory Overman)', 100, 1180);
    ctx.fillText('Countersigned: Rajesh Kumar (Mine Manager)', 580, 1180);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#444';
    ctx.fillText('OFFICIAL REGIONAL AUDIT REGISTER - DHANBAD REGION I', 320, 1310);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'DGMS_Statutory_Shift_Gas_Log_Moonidih.png', { type: 'image/png' });
        setUploadFile(file);
        setUploadDocName('DGMS Form IV - Moonidih Seam XVI Gas Log');
      }
    }, 'image/png');
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file or click "Generate Sample Statutory Log".');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessMsg(null);

    try {
      const res: OcrSubmitResponse = await submitOcrDocument(
        uploadFile,
        uploadDocName || uploadFile.name,
        uploadLang
      );

      if (res.status === 'auto_approved') {
        setUploadSuccessMsg(
          `Document parsed successfully with high confidence (${formatConfidence(res.overall_confidence)}) and auto-approved!`
        );
      } else {
        setUploadSuccessMsg(
          `Document processed (confidence: ${formatConfidence(res.overall_confidence)}). Enqueued for statutory review!`
        );
      }

      await loadQueue();
      if (onRefreshCount) onRefreshCount();

      setTimeout(() => {
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadDocName('');
        setUploadSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      const errData = err?.response?.data;
      const detailMsg =
        typeof errData?.detail === 'object'
          ? (errData.detail.message || JSON.stringify(errData.detail))
          : (errData?.detail || err?.message || 'Failed to submit document for OCR processing.');
      setUploadError(detailMsg);
    } finally {
      setIsUploading(false);
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
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white text-zinc-950 font-sans">
      {/* ------------------------------------------------------------------- */}
      {/* Top Header Controls */}
      {/* ------------------------------------------------------------------- */}
      <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white shadow-xs mb-6">
        {/* Top Header: Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Document Verification Queue
            </span>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                Review Scanned Paper Logs
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-semibold inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-blue-600" />
                {queue.length} Pending Review
              </span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowUploadModal(true);
                setUploadError(null);
                setUploadSuccessMsg(null);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="size-3.5" />
              <span>Upload Statutory Log (OCR)</span>
            </button>

            <button
              onClick={loadQueue}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              title="Refresh OCR queue"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dedicated Document Switcher Row */}
        {queue.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-3 mt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
              Queue Documents ({queue.length}):
            </span>
            {queue.map((item, i) => {
              const isSelected = item.id === currentItem?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="size-3.5" />
                  <span className="truncate max-w-[160px]">{item.document_name || `Report #${i + 1}`}</span>
                  {item.status === 'approved' && (
                    <Check className="size-3 text-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700 flex items-center gap-2">
            <AlertCircle className="size-4 text-zinc-600" />
            <span>Could not fetch OCR queue: {error}</span>
          </div>
        )}

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

      {/* ------------------------------------------------------------------- */}
      {/* Upload Modal (True Statutory Document Ingestion) */}
      {/* ------------------------------------------------------------------- */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                    <Upload className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Upload Statutory Paper Document</h3>
                    <p className="text-[11px] text-slate-500">DGMS Form IV, Ventilation Logs, Shift Registers</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-200 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>{uploadSuccessMsg}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                    Document Title / Statutory Tag
                  </label>
                  <input
                    type="text"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    placeholder="e.g. DGMS Form IV - Moonidih Seam XVI Shift Log"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-black"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                      OCR Language Engine
                    </label>
                    <select
                      value={uploadLang}
                      onChange={(e) => setUploadLang(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-zinc-200 bg-zinc-50"
                    >
                      <option value="eng">English (Tesseract 5)</option>
                      <option value="hin">Hindi (PoC Devanagari)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                      Target Coalfield
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Moonidih Colliery (Jharia)"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-zinc-200 bg-zinc-100 text-zinc-500 font-mono"
                    />
                  </div>
                </div>

                {/* File Dropzone */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                    Scanned Document File (PNG, JPG, WEBP)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                        if (!uploadDocName) setUploadDocName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-300 hover:border-black rounded-2xl p-6 text-center cursor-pointer transition-colors bg-zinc-50 hover:bg-zinc-100/60"
                  >
                    <FileText className="size-8 text-zinc-400 mx-auto mb-2" />
                    {uploadFile ? (
                      <div>
                        <p className="text-xs font-bold text-black">{uploadFile.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {(uploadFile.size / 1024).toFixed(1)} KB &bull; Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-zinc-700">Click to browse or drop document scan</p>
                        <p className="text-[10px] text-zinc-400 mt-1">High-resolution camera capture or flatbed scan</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instant Sample Generator */}
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-blue-700 shrink-0" />
                    <span className="text-xs text-blue-900 font-medium">
                      Need a test scan? Load authentic DGMS statutory log:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSampleDocument}
                    className="px-3 py-1 rounded-lg bg-blue-800 hover:bg-blue-700 text-white text-[11px] font-semibold shrink-0 transition-colors cursor-pointer"
                  >
                    Load Sample DGMS Log
                  </button>
                </div>

                {/* Modal Actions */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-5 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Running OCR Engine...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="size-3.5" />
                        <span>Process & Ingest Document</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------- */}
      {/* Empty State */}
      {/* ------------------------------------------------------------------- */}
      {!isLoading && queue.length === 0 && !error ? (
        <div className="border border-slate-200 rounded-2xl p-12 bg-white text-center space-y-4">
          <div className="inline-flex p-4 rounded-2xl bg-slate-100 border border-slate-200">
            <Inbox className="size-8 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              OCR Verification Queue Clear
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              All scanned statutory field logs have been verified and processed into the official registry. Upload a handwritten document to test the OCR engine.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setShowUploadModal(true);
                setUploadError(null);
                setUploadSuccessMsg(null);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-800 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Upload className="size-3.5" /> Upload Statutory Scan
            </button>
            <button
              onClick={loadQueue}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>
        </div>
      ) : currentItem ? (
        /* ----------------------------------------------------------------- */
        /* Split Workspace: Document Image on Left & Extracted Text on Right */
        /* ----------------------------------------------------------------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Document Image Canvas */}
          <div className="lg:col-span-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="p-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-zinc-400" />
                <span className="text-xs font-semibold text-black truncate max-w-[200px]">
                  {currentItem.document_name || 'Statutory Inspection Sheet'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
                  className="p-1.5 text-zinc-500 hover:text-black rounded-lg hover:bg-zinc-200 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <span className="text-[11px] font-mono text-zinc-400 w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                  className="p-1.5 text-zinc-500 hover:text-black rounded-lg hover:bg-zinc-200 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 text-zinc-500 hover:text-black rounded-lg hover:bg-zinc-200 transition-colors"
                  title="Rotate Scan"
                >
                  <RotateCw className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="relative h-[550px] bg-zinc-100 flex items-center justify-center overflow-auto p-4 select-none">
              {imageLoading && (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <Loader2 className="size-6 animate-spin" />
                  <span className="text-xs">Decrypting statutory scan...</span>
                </div>
              )}
              {imageError && (
                <div className="flex flex-col items-center gap-2 text-zinc-400 p-6 text-center">
                  <ImageOff className="size-8 text-zinc-300" />
                  <span className="text-xs font-medium">Document preview stream unavailable</span>
                </div>
              )}
              {!imageLoading && !imageError && imageBlob && (
                <div
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="origin-center shadow-lg rounded-lg overflow-hidden"
                >
                  <img
                    src={imageBlob}
                    alt="Statutory Form Scan"
                    className="max-h-[500px] object-contain block bg-white"
                  />
                </div>
              )}
            </div>

            <div className="p-3 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3 text-zinc-400" />
                {new Date(currentItem.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="size-3 text-zinc-400" />
                {maskInspector(currentItem.submitted_by_id)}
              </span>
            </div>
          </div>

          {/* RIGHT: OCR Text & Side-by-Side Review Pane */}
          <div className="lg:col-span-6 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs flex flex-col h-[645px]">
            <div className="p-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <Edit2 className="size-4 text-zinc-400" />
                <span className="text-xs font-semibold text-black">
                  Tesseract Extracted Text (Editable)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Confidence:</span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                    currentItem.overall_confidence >= 0.7
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {formatConfidence(currentItem.overall_confidence)}
                </span>
              </div>
            </div>

            {/* Low-confidence words warning */}
            {uncertainWords.length > 0 && (
              <div className="p-2.5 bg-amber-50/80 border-b border-amber-200/60 px-4 flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  <span>
                    <strong className="font-semibold">{uncertainWords.length} low-confidence words</strong> flagged for statutory check
                  </span>
                </div>
                <span className="text-[10px] font-mono text-amber-700">Threshold: 70%</span>
              </div>
            )}

            {/* Textarea */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <textarea
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="No extracted text available..."
                className="w-full flex-1 p-3.5 rounded-xl border border-zinc-200 text-xs font-mono text-zinc-800 focus:outline-none focus:border-black resize-none bg-zinc-50/50 leading-relaxed"
              />
            </div>

            {/* Verification Action Bar */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                Reject Scan
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Sealing Record...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>Approve & Seal into Statutory Ledger</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
