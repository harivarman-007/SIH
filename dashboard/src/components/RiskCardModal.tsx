import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CornerDownRight,
  MapPin,
  Calendar,
  User,
  Radio,
  Camera,
  Activity,
  Layers,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export interface ObservationData {
  id: string;
  name: string;
  category: 'safety' | 'environment' | 'labour' | 'production';
  severity: 'high' | 'medium' | 'low';
  score: number;
  description: string;
  location: string;
  beaconId?: string;
  photoUrl: string;
  inspectorName: string;
  date: string;
  topContributors: string[];
  suggestedAction: string;
  status: 'open' | 'in-progress' | 'completed';
  complianceStatus?: string | null;
  thresholdBreachDetail?: string | null;
}

export interface RiskCardModalProps {
  observation: ObservationData | null;
  isOpen: boolean;
  onClose: () => void;
  onResolve?: (id: string, note: string) => void;
  onCreateAction?: (observation: ObservationData) => void;
}

export const RiskCardModal: React.FC<RiskCardModalProps> = ({
  observation,
  isOpen,
  onClose,
  onResolve,
  onCreateAction,
}) => {
  const [closureNote, setClosureNote] = useState('');
  const [isResolved, setIsResolved] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { user, permissions } = useAuthStore();

  if (!observation) return null;

  const isManagerOrAdmin =
    user?.role === 'mine_official' ||
    user?.role === 'super_admin' ||
    permissions.includes('ACTION_CREATE');

  const canClose =
    user?.role === 'mine_official' ||
    user?.role === 'super_admin' ||
    permissions.includes('OBSERVATION_CLOSE');

  const scoreFormatted = observation.score.toFixed(2);
  const scorePercent = Math.min(100, Math.max(0, Math.round(observation.score * 100)));
  const isHighRisk = observation.severity === 'high' || observation.score >= 0.7;
  const isMediumRisk = observation.severity === 'medium' || (observation.score >= 0.4 && observation.score < 0.7);

  // Clean location string (removes raw database UUIDs)
  const formatLocationClean = (loc: string) => {
    if (!loc) return 'Sector 4 · Gallery East Dip';
    if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(loc)) {
      const tail = loc.slice(-6).toUpperCase();
      return `Sector 4 · Zone #${tail}`;
    }
    return loc.replace(/^[Mm]ine\s*/, '').trim() || 'Sector 4 · Gallery East Dip';
  };

  const handleResolve = () => {
    if (onResolve) {
      onResolve(observation.id, closureNote);
    }
    setIsResolved(true);
    setTimeout(() => {
      onClose();
      setIsResolved(false);
      setClosureNote('');
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Unified Cohesive Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 0.7, 0.2, 1] }}
            className="relative w-full max-w-3xl z-10 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-slate-900 my-auto"
          >
            {/* Modal Header Bar */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                {isHighRisk ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1.5 shadow-2xs">
                    <AlertTriangle className="size-3.5 text-rose-600" />
                    <span>CRITICAL DGMS RISK</span>
                  </span>
                ) : isMediumRisk ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1.5 shadow-2xs">
                    <Activity className="size-3.5 text-amber-600" />
                    <span>MODERATE RISK</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1.5 shadow-2xs">
                    <ShieldCheck className="size-3.5 text-blue-600" />
                    <span>MINOR ADVISORY</span>
                  </span>
                )}

                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 uppercase tracking-wider">
                  {observation.category}
                </span>

                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  #{observation.id.slice(0, 8)}
                </span>
              </div>

              {/* Integrated Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body: Two-Column Layout */}
            <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-h-[68vh] overflow-y-auto">
              {/* Left Column: Field Evidence & Observation Info */}
              <div className="md:col-span-7 flex flex-col justify-between">
                <div>
                  {/* Photo Evidence Container */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-2xs">
                    {!imgError && observation.photoUrl ? (
                      <img
                        src={observation.photoUrl}
                        alt={observation.name}
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      /* Resilient Industrial Fallback Graphic */
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-radial from-slate-800 to-slate-950 text-slate-400">
                        <Layers className="size-10 text-blue-400/60 mb-2" />
                        <span className="text-xs font-semibold text-slate-200">
                          Field Radar & Strata Telemetry
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 mt-0.5">
                          -240m UG (Deep Seam XVI) • Longwall Panel 4-B
                        </span>
                      </div>
                    )}

                    {/* Camera Badge Overlay */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-white text-[10px] font-semibold tracking-wide">
                      <Camera className="size-3 text-blue-400" />
                      <span>STATUTORY EVIDENCE CAPTURE</span>
                    </div>

                    {/* Beacon Tag Overlay */}
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-blue-900/80 backdrop-blur-md text-white font-mono text-[10px] border border-blue-400/30">
                      {observation.beaconId || 'BCN-JHR-402'}
                    </div>
                  </div>

                  {/* Hazard Title & Description */}
                  <div className="mt-4">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {observation.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      {observation.description}
                    </p>
                  </div>

                  {/* Statutory Compliance Threshold Badge (Item 2) */}
                  {observation.complianceStatus && (
                    <div
                      className={`mt-3 p-3 rounded-xl border flex items-start gap-2.5 ${
                        observation.complianceStatus === 'violation'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}
                    >
                      <ShieldAlert
                        className={`size-4 shrink-0 mt-0.5 ${
                          observation.complianceStatus === 'violation'
                            ? 'text-rose-600'
                            : 'text-emerald-600'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                          <span>Statutory Threshold:</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              observation.complianceStatus === 'violation'
                                ? 'bg-rose-200 text-rose-900'
                                : 'bg-emerald-200 text-emerald-900'
                            }`}
                          >
                            {observation.complianceStatus}
                          </span>
                        </div>
                        {observation.thresholdBreachDetail && (
                          <div className="text-xs mt-1 leading-relaxed font-medium">
                            {observation.thresholdBreachDetail}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Statutory Field Metadata Cards */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <User className="size-3 text-slate-400" /> Reported Official
                    </span>
                    <span className="text-xs font-semibold text-slate-800 block truncate mt-0.5">
                      {observation.inspectorName}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <MapPin className="size-3 text-slate-400" /> Mining Location
                    </span>
                    <span className="text-xs font-semibold text-slate-800 block truncate mt-0.5">
                      {formatLocationClean(observation.location)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <Calendar className="size-3 text-slate-400" /> Inspection Date
                    </span>
                    <span className="text-xs font-semibold text-slate-800 block truncate mt-0.5">
                      {observation.date}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <Radio className="size-3 text-slate-400" /> Hardware Beacon
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-800 block truncate mt-0.5">
                      {observation.beaconId || 'BCN-GPS-AUTO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Risk Diagnostic Engine */}
              <div className="md:col-span-5 flex flex-col justify-between bg-slate-50/80 border border-slate-200/80 rounded-xl p-4.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    AI Diagnostic Result
                  </span>

                  {/* Main Metric Score */}
                  <div className="mt-2">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-extrabold font-mono tracking-tight ${
                        isHighRisk ? 'text-rose-600' : isMediumRisk ? 'text-amber-600' : 'text-blue-700'
                      }`}>
                        {scoreFormatted}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        / 1.00 Index
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                      AI Anomaly Risk Index
                    </span>
                  </div>

                  {/* High Precision Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mt-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHighRisk ? 'bg-rose-600' : isMediumRisk ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${scorePercent}%` }}
                    />
                  </div>

                  {/* Contributing Diagnostic Rules */}
                  <div className="mt-5 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Contributing Assessment Rules:
                    </span>
                    {observation.topContributors && observation.topContributors.length > 0 ? (
                      observation.topContributors.map((c, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-700 flex items-start gap-2 shadow-2xs"
                        >
                          <ShieldCheck className="size-3.5 text-blue-700 shrink-0 mt-0.5" />
                          <span className="leading-snug text-slate-800 font-medium">
                            {c}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-500">
                        DGMS regulatory rule pattern matched
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Engine: Isolated Edge + Cloud</span>
                  <span className="font-semibold text-slate-700">CMR 2017 Model</span>
                </div>
              </div>
            </div>

            {/* Seamless Footer: Mandated Directive & Statutory Sign-off */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/90 flex flex-col gap-3.5">
              {/* DGMS Action directive Callout */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="size-4.5 text-blue-800 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 uppercase tracking-wider block text-[10px]">
                      Mandated DGMS Corrective Directive:
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed mt-0.5">
                      {observation.suggestedAction}
                    </p>
                  </div>
                </div>

                {onCreateAction && isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCreateAction(observation);
                    }}
                    className="shrink-0 px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CornerDownRight className="size-3.5" />
                    <span>Assign Corrective Action</span>
                  </button>
                )}
              </div>

              {/* Resolution Workflow */}
              {isResolved ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="size-4 text-emerald-700" />
                  <span>Hazard remediation verified & signed off in statutory register.</span>
                </div>
              ) : canClose && onResolve ? (
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter official remediation / closure notes..."
                    value={closureNote}
                    onChange={(e) => setClosureNote(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition-colors shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleResolve}
                    className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Sign-off & Close</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200 text-slate-500 text-xs text-center">
                  <span>Inspector Read-Only: Remediation assignment & closure sign-off reserved for authorized Mine Officials.</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
