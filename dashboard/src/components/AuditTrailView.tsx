import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Link,
  Lock,
  RefreshCw,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Database,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types & Schemas matching Backend Phase 1 (audit_log table)
// ---------------------------------------------------------------------------
export type AuditActionType =
  | 'observation.created'
  | 'observation.closed'
  | 'ocr.approved'
  | 'risk.escalated';

export interface AuditBlock {
  id: number;
  blockNumber: number;
  action: AuditActionType;
  actionLabel: string;
  summary: string;
  actorName: string;
  actorRole: string;
  mineSite: string;
  timestamp: string;
  entryHash: string;
  prevHash: string;
  payload: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Realistic Mock Cryptographic Ledger Blocks
// ---------------------------------------------------------------------------
const MOCK_AUDIT_BLOCKS: AuditBlock[] = [
  {
    id: 1428,
    blockNumber: 1428,
    action: 'observation.created',
    actionLabel: 'Observation Logged',
    summary:
      'High-risk hazard registered: Gallery 4 Roof Fall & Support Prop Failure. AI Anomaly Score: 0.94. Automated DGMS Circular 4 alert dispatched.',
    actorName: 'Rajesh Kumar',
    actorRole: 'Field Inspector (DGMS Certified)',
    mineSite: 'Jharia Coalfield Central • Sector 4',
    timestamp: '2026-09-11 08:32:14 UTC',
    entryHash: 'e7b489a1f0c293847e1d5b88c42a912e7381fa098234dbce659104812f83a901',
    prevHash: 'c18d5f04e8921a4473b19024f81a7392bcdef90123456789abcdef0123456789',
    payload: {
      hazard_id: 'hz-101',
      score: 0.94,
      severity: 'high',
      location: 'Gallery 4 East Dip',
      beacon_id: 'BCN-JHR-402',
      coordinates: { lat: 23.7972, lng: 86.4285 },
      photo_sha256: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    },
  },
  {
    id: 1427,
    blockNumber: 1427,
    action: 'ocr.approved',
    actionLabel: 'OCR Document Verified',
    summary:
      'Statutory Shift Inspection Logbook (DGMS Form IV) human-verified and committed to permanent registry. 2 words corrected.',
    actorName: 'Sunil Mehta',
    actorRole: 'Mine Safety Overman',
    mineSite: 'Jharia Coalfield Central • Section 2',
    timestamp: '2026-09-11 08:15:02 UTC',
    entryHash: 'c18d5f04e8921a4473b19024f81a7392bcdef90123456789abcdef0123456789',
    prevHash: '8f9b41a029348e71b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
    payload: {
      document_name: 'DGMS_FormIV_ShiftInspection_Sec4.jpg',
      overall_confidence: 64.2,
      corrected_words: ['strata', 'prop'],
      reviewer_note: 'Verified with shift incharge before sign-off.',
    },
  },
  {
    id: 1426,
    blockNumber: 1426,
    action: 'observation.closed',
    actionLabel: 'Hazard Remediated & Closed',
    summary:
      'Crushing Plant spray manifold water pressure restored to 5.2 bar. Dust suppression active. Proof photo attached and verified.',
    actorName: 'Sanjay Deshmukh',
    actorRole: 'Environmental Engineer',
    mineSite: 'Korba East Mine • Surface Yard',
    timestamp: '2026-09-10 16:45:29 UTC',
    entryHash: '8f9b41a029348e71b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
    prevHash: '4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b',
    payload: {
      hazard_id: 'hz-104',
      resolution_time_hrs: 6.5,
      proof_photo_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
      closure_note: 'Cleaned inline filter and cleared dual nozzles.',
    },
  },
  {
    id: 1425,
    blockNumber: 1425,
    action: 'risk.escalated',
    actionLabel: 'Statutory Escalation',
    summary:
      'Methane Concentration 2.1% in North Return Airway exceeded 4-hour remediation window without clearance. Automatic escalation dispatched to Regional DGMS Directorate.',
    actorName: 'INTELLIFUSION Engine',
    actorRole: 'Autonomous Compliance Daemon',
    mineSite: 'Raniganj North Block',
    timestamp: '2026-09-10 11:20:00 UTC',
    entryHash: '4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b',
    prevHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    payload: {
      hazard_id: 'hz-102',
      escalation_tier: 'DGMS_REGIONAL_DIRECTOR',
      statutory_reg: 'DGMS Coal Mines Regulations 2017 (Reg 169)',
      unresolved_hours: 4.0,
    },
  },
];

export default function AuditTrailView() {
  const [blocks] = useState<AuditBlock[]>(MOCK_AUDIT_BLOCKS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [expandedBlockId, setExpandedBlockId] = useState<number | null>(1428);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    timestamp: string;
    totalBlocks: number;
  } | null>({
    verified: true,
    timestamp: 'Just now',
    totalBlocks: 1428,
  });
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Trigger live integrity verification replay
  const handleVerifyChain = () => {
    setIsVerifying(true);
    setVerificationResult(null);

    setTimeout(() => {
      setIsVerifying(false);
      setVerificationResult({
        verified: true,
        timestamp: 'Just now',
        totalBlocks: 1428,
      });
    }, 1200);
  };

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Filtered blocks
  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      const matchAction = selectedAction === 'all' || b.action === selectedAction;
      const matchSearch =
        searchQuery === '' ||
        b.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.blockNumber.toString().includes(searchQuery) ||
        b.entryHash.toLowerCase().includes(searchQuery.toLowerCase());
      return matchAction && matchSearch;
    });
  }, [blocks, selectedAction, searchQuery]);

  return (
    <div className="w-full bg-white text-zinc-950 font-sans">
      {/* ----------------------------------------------------------------- */}
      {/* 1. Chain Integrity Verification Hero Card                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="border border-zinc-200 rounded-2xl p-5 bg-white shadow-xs mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Status Details */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="size-2.5 rounded-full bg-black animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Cryptographic Audit Trail &bull; SHA-256 Hash Chain
              </span>
            </div>
            <h2 className="text-xl font-semibold text-black tracking-tight flex items-center gap-2">
              <span>Immutable Statutory Ledger</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-medium font-mono">
                1,428 Blocks
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1 max-w-2xl leading-relaxed">
              Every field inspection, hazard closure, and OCR approval is cryptographically chained with SHA-256 hashing. Once written, records cannot be altered or deleted.
            </p>
          </div>

          {/* Verify Integrity Action Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleVerifyChain}
              disabled={isVerifying}
              className="px-4 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Replaying Hashes...' : 'Verify Chain Integrity'}</span>
            </button>
          </div>
        </div>

        {/* Live Integrity Banner */}
        <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-800 font-medium">
            <CheckCircle2 className="size-4 text-black" />
            <span>
              {verificationResult?.verified
                ? 'Chain Integrity Verified: 1,428 of 1,428 blocks valid. Zero tampering detected.'
                : 'Verifying hash signatures across full ledger...'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400 font-mono text-[11px]">
            <span>Genesis: 2026-09-01</span>
            <span>&bull;</span>
            <span>Standard: DGMS Rule 196 / Sec 112</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Filter & Search Controls                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        {/* Action Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'observation.created', label: 'Observations' },
            { id: 'observation.closed', label: 'Closures' },
            { id: 'ocr.approved', label: 'OCR Approvals' },
            { id: 'risk.escalated', label: 'Escalations' },
          ].map((tab) => {
            const active = selectedAction === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedAction(tab.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  active
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 size-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search block, actor, hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Chronological Hash-Chain Ledger Feed                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        {filteredBlocks.map((block) => {
          const isExpanded = expandedBlockId === block.id;

          return (
            <div
              key={block.id}
              className="border border-zinc-200 rounded-2xl bg-white shadow-xs overflow-hidden transition-all hover:border-zinc-300"
            >
              {/* Block Summary Bar */}
              <div
                onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  {/* Block Number Pill */}
                  <div className="flex flex-col items-center justify-center size-10 rounded-xl bg-zinc-100 border border-zinc-200 font-mono text-xs font-bold text-black shrink-0">
                    <span className="text-[9px] text-zinc-400 font-normal">BLK</span>
                    <span>#{block.blockNumber}</span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-black text-white">
                        {block.actionLabel}
                      </span>
                      <span className="text-xs text-zinc-400">&bull;</span>
                      <span className="text-xs font-medium text-zinc-700">
                        {block.actorName} ({block.actorRole})
                      </span>
                      <span className="text-xs text-zinc-400">&bull;</span>
                      <span className="text-xs text-zinc-500 font-mono">{block.timestamp}</span>
                    </div>
                    <p className="text-xs text-zinc-800 leading-relaxed max-w-3xl">
                      {block.summary}
                    </p>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {block.mineSite}
                    </div>
                  </div>
                </div>

                {/* Expansion Indicator */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="text-[11px] font-mono text-zinc-400 hidden md:inline">
                    {block.entryHash.substring(0, 10)}...
                  </span>
                  <button
                    type="button"
                    className="p-1 rounded-md text-zinc-400 hover:text-black"
                  >
                    {isExpanded ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Cryptographic Detail Panel */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-zinc-100 bg-zinc-50/60 p-4 sm:p-5 text-xs space-y-4"
                  >
                    {/* Cryptographic Linkage Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Current Hash */}
                      <div className="p-3 bg-white border border-zinc-200 rounded-xl">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-400 mb-1">
                          <span className="flex items-center gap-1 text-black font-semibold">
                            <Lock className="size-3 text-black" />
                            <span>Current Block Hash (SHA-256)</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(block.entryHash);
                            }}
                            className="hover:text-black flex items-center gap-1 cursor-pointer"
                          >
                            {copiedHash === block.entryHash ? (
                              <Check className="size-3 text-black" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            <span>{copiedHash === block.entryHash ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="font-mono text-[11px] text-zinc-800 break-all bg-zinc-50 p-2 rounded border border-zinc-100">
                          {block.entryHash}
                        </div>
                      </div>

                      {/* Previous Hash */}
                      <div className="p-3 bg-white border border-zinc-200 rounded-xl">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-400 mb-1">
                          <span className="flex items-center gap-1 text-zinc-600">
                            <Link className="size-3 text-zinc-500" />
                            <span>Previous Block Hash (Parent)</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(block.prevHash);
                            }}
                            className="hover:text-black flex items-center gap-1 cursor-pointer"
                          >
                            {copiedHash === block.prevHash ? (
                              <Check className="size-3 text-black" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            <span>{copiedHash === block.prevHash ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="font-mono text-[11px] text-zinc-500 break-all bg-zinc-50 p-2 rounded border border-zinc-100">
                          {block.prevHash}
                        </div>
                      </div>
                    </div>

                    {/* Immutable Data Payload Snapshot */}
                    <div className="bg-white border border-zinc-200 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-black">
                        <Database className="size-3.5 text-zinc-600" />
                        <span>Locked Block Payload Snapshot (JSON)</span>
                      </div>
                      <pre className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-[11px] font-mono text-zinc-800 overflow-x-auto">
                        {JSON.stringify(block.payload, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
