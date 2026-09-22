/**
 * ComingSoonStub — Placeholder card for unbuilt pages (Phases 28 & 30).
 * Clearly displays target phase and status.
 */
import React from 'react';
import { Construction, Sparkles, Clock } from 'lucide-react';

interface ComingSoonStubProps {
  title: string;
  subtitle?: string;
  targetPhase: number;
}

export const ComingSoonStub: React.FC<ComingSoonStubProps> = ({
  title,
  subtitle,
  targetPhase,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-600 shadow-sm">
        <Construction className="w-8 h-8 text-amber-600 animate-pulse" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs font-medium uppercase tracking-wider mb-3">
        <Clock className="w-3.5 h-3.5" />
        Scheduled for Phase {targetPhase}
      </div>

      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
        {title}
      </h2>

      <p className="text-sm text-zinc-500 max-w-md mb-6 leading-relaxed">
        {subtitle ||
          `This operational interface is currently scheduled for implementation in Phase ${targetPhase}. All backend data structures and permission boundaries are fully active.`}
      </p>

      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-500 max-w-md text-left flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-zinc-800">State:</span> Staged stub. Tracked in <code className="bg-zinc-200/60 px-1 py-0.5 rounded font-mono text-[11px]">task.md</code> as <code className="bg-zinc-200/60 px-1 py-0.5 rounded font-mono text-[11px]">[~] stubbed (Phase {targetPhase})</code>.
        </div>
      </div>
    </div>
  );
};

export default ComingSoonStub;
