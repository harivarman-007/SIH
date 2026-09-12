import { useState, useMemo, useEffect, useCallback } from 'react';
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
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { fetchAuditLog, verifyAuditChain, AuditLogEntry, AuditVerifyResult } from '@/api/audit';

// ---------------------------------------------------------------------------
// Types & Schemas matching Backend Phase 1 (audit_log table)
// ---------------------------------------------------------------------------
export type AuditActionType =
  | 'observation.created'
  | 'observation.closed'
  | 'ocr.approved'
  | 'ocr.rejected'
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

function mapAuditEntryToBlock(entry: AuditLogEntry): AuditBlock {
  const payload = (entry.payload as Record<string, any>) || {};
  let actionLabel = 'Audit Event';
  if (entry.action === 'observation.created') actionLabel = 'Observation Logged';
  else if (entry.action === 'observation.closed') actionLabel = 'Hazard Remediated & Closed';
  else if (entry.action === 'ocr.approved') actionLabel = 'OCR Document Verified';
  else if (entry.action === 'ocr.rejected') actionLabel = 'OCR Document Rejected';
  else if (entry.action === 'risk.escalated') actionLabel = 'Hazard Escalated';

  let summary =
    (payload.description as string) ||
    (payload.summary as string) ||
    (payload.title as string) ||
    `${entry.action} registered in statutory ledger.`;

  if (entry.action === 'observation.created') {
    summary =
      (payload.title as string) ||
      (payload.description as string) ||
      `Observation #${payload.id ?? payload.observation_id ?? entry.id} registered.`;
  } else if (entry.action === 'observation.closed') {
    summary =
      (payload.closure_note as string) ||
      `Observation #${payload.observation_id ?? entry.id} remediation signed off and closed.`;
  }

  return {
    id: entry.id,
    blockNumber: entry.id,
    action: entry.action as AuditActionType,
    actionLabel,
    summary,
    actorName:
      (payload.actor_name as string) ||
      (entry.actor_id ? `Official (${entry.actor_id.slice(0, 8)})` : 'Autonomous Compliance Daemon'),
    actorRole:
      (payload.actor_role as string) ||
      (entry.actor_id ? 'Field Official' : 'INTELLIFUSION Engine'),
    mineSite: (payload.mine_site as string) || 'Jharia Coalfield Central • Sector 4',
    timestamp: entry.ts ? new Date(entry.ts).toUTCString() : 'Recent',
    entryHash: entry.entry_hash,
    prevHash: entry.prev_hash,
    payload: entry.payload,
  };
}

interface AuditTrailViewProps {
  role?: string;
}

export default function AuditTrailView({ role }: AuditTrailViewProps) {
  const [blocks, setBlocks] = useState<AuditBlock[]>([]);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [expandedBlockId, setExpandedBlockId] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AuditVerifyResult | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const isRegulator = role === 'regulator';

  // Load audit blocks from backend
  const loadLedger = useCallback(async () => {
    if (!isRegulator) {
      setBlocks([]);
      return;
    }
    setIsLoadingBlocks(true);
    setBlockError(null);
    try {
      const data = await fetchAuditLog(100);
      const mapped = data.map(mapAuditEntryToBlock);
      setBlocks(mapped);
      if (mapped.length > 0 && expandedBlockId === null) {
        setExpandedBlockId(mapped[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch audit log';
      setBlockError(msg);
    } finally {
      setIsLoadingBlocks(false);
    }
  }, [isRegulator]);

  // Run chain verification against real backend
  const handleVerifyChain = useCallback(async () => {
    setIsVerifying(true);
    try {
      const res = await verifyAuditChain();
      setVerificationResult(res);
    } catch (err) {
      setVerificationResult({
        is_valid: false,
        total_checked: 0,
        broken_at_id: null,
        message: err instanceof Error ? err.message : 'Verification request failed',
      });
    } finally {
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    handleVerifyChain();
  }, [handleVerifyChain]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

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
                {verificationResult ? `${verificationResult.total_checked} Blocks Verified` : 'Verifying...'}
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
            {verificationResult?.is_valid ? (
              <>
                <CheckCircle2 className="size-4 text-black" />
                <span>
                  Chain Integrity Verified: {verificationResult.total_checked} of {verificationResult.total_checked} blocks valid. Zero tampering detected.
                </span>
              </>
            ) : verificationResult && !verificationResult.is_valid ? (
              <>
                <ShieldAlert className="size-4 text-zinc-900" />
                <span className="font-semibold text-black">
                  Chain Tampering Detected: Broken at block #{verificationResult.broken_at_id ?? 'Unknown'}. {verificationResult.message}
                </span>
              </>
            ) : (
              <>
                <Loader2 className="size-4 animate-spin text-zinc-400" />
                <span>Replaying hash signatures across full database ledger...</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4 text-zinc-400 font-mono text-[11px]">
            <span>Genesis: 2026-09-01</span>
            <span>&bull;</span>
            <span>Standard: DGMS Rule 196 / Sec 112</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Filter & Search Controls (Only shown for regulator)           */}
      {/* ----------------------------------------------------------------- */}
      {isRegulator ? (
        <>
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
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
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

          {/* Error Banner */}
          {blockError && (
            <div className="mb-4 p-4 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-700">
              ⚠ Failed to load audit blocks: {blockError}
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* 3. Chronological Hash-Chain Ledger Feed                           */}
          {/* ----------------------------------------------------------------- */}
          <div className="space-y-4">
            {isLoadingBlocks ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-zinc-200 rounded-2xl p-5 bg-white shadow-xs animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-zinc-100" />
                    <div className="flex-grow space-y-2">
                      <div className="h-4 w-1/3 bg-zinc-100 rounded" />
                      <div className="h-3 w-2/3 bg-zinc-100 rounded" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredBlocks.length === 0 ? (
              <div className="text-center py-12 border border-zinc-200 rounded-2xl bg-white text-zinc-400 text-xs">
                No audit records found matching your filters.
              </div>
            ) : (
              filteredBlocks.map((block) => {
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
              })
            )}
          </div>
        </>
      ) : (
        /* Access Restricted Banner for non-regulators */
        <div className="border border-zinc-200 rounded-2xl p-8 bg-zinc-50 text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-white border border-zinc-200 shadow-xs">
            <ShieldCheck className="size-6 text-black" />
          </div>
          <h3 className="text-base font-semibold text-black">
            Regulator Clearance Required For Detailed Ledger Feed
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            Raw cryptographic block inspection is restricted to DGMS Regulatory Authorities under statutory safety laws. You can still verify full hash chain integrity using the button above.
          </p>
          <p className="text-xs font-medium text-zinc-800 pt-2">
            Tip: Select <span className="font-semibold px-2 py-0.5 bg-zinc-200 rounded text-black">Regulator</span> in the top-right role switcher to inspect live ledger blocks.
          </p>
        </div>
      )}
    </div>
  );
}
