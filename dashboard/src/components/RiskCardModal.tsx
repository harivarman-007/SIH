import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ShieldCheck, CornerDownRight } from 'lucide-react';
import { CaseMetricCard } from './CaseMetricCard';

export interface ObservationData {
  id: string;
  name: string;
  category: 'safety' | 'environment' | 'labour';
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
}

export interface RiskCardModalProps {
  observation: ObservationData | null;
  isOpen: boolean;
  onClose: () => void;
  onResolve?: (id: string, note: string) => void;
}

export const RiskCardModal: React.FC<RiskCardModalProps> = ({
  observation,
  isOpen,
  onClose,
  onResolve,
}) => {
  const [closureNote, setClosureNote] = useState('');
  const [isResolved, setIsResolved] = useState(false);

  if (!observation) return null;

  const scoreFormatted = observation.score.toFixed(2);
  const scorePercent = Math.round(observation.score * 100);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 0.7, 0.2, 1] }}
            className="relative w-full max-w-2xl z-10 flex flex-col gap-3 max-h-[95vh] overflow-y-auto"
          >
            {/* Close Button Floating */}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700 shadow-md transition-all"
              >
                <span>Close</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Framer CaseMetricCard Component */}
            <CaseMetricCard
              title={observation.name}
              description={observation.description}
              category={`${observation.category.toUpperCase()} &bull; ${observation.severity.toUpperCase()} RISK`}
              projectImage={observation.photoUrl}
              clientName={`${observation.inspectorName} (${observation.location})`}
              mainMetric={scoreFormatted}
              metricLabel="AI Anomaly Risk Index"
              progressValue={scorePercent}
              resultBadge="AI DIAGNOSTIC RESULT"
              stat1Value={observation.topContributors[0] ? observation.topContributors[0].split(' ')[0] : 'Elevated'}
              stat1Label={observation.topContributors[0] || 'Keyword Detection'}
              stat2Value={observation.topContributors[1] ? observation.topContributors[1].split(' ')[0] : 'Zone'}
              stat2Label={observation.topContributors[1] || 'Baseline Risk'}
              stat3Value={observation.topContributors[2] ? observation.topContributors[2].split(' ')[0] : 'Threshold'}
              stat3Label={observation.topContributors[2] || 'Uninspected Duration'}
              ctaText="Statutory DGMS Action"
              onCtaClick={() => {}}
            />

            {/* Statutory Action Callout & Closure Sign-off Box */}
            <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm text-zinc-950 flex flex-col gap-4">
              {/* DGMS Action directive */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                <ShieldCheck className="w-4 h-4 text-black shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-black uppercase tracking-wider block mb-0.5 text-[10px]">
                    Mandated DGMS Corrective Directive:
                  </span>
                  <p className="text-zinc-700 leading-relaxed">
                    {observation.suggestedAction}
                  </p>
                </div>
              </div>

              {/* Resolution Workflow */}
              {isResolved ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-black p-3 bg-zinc-100 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>Hazard remediation verified & signed off in statutory register.</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter official remediation / closure notes..."
                    value={closureNote}
                    onChange={(e) => setClosureNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-zinc-50 border border-zinc-200 text-black placeholder:text-zinc-400 focus:outline-none focus:border-black transition-colors"
                  />
                  <button
                    onClick={handleResolve}
                    className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <span>Sign-off</span>
                    <CornerDownRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
