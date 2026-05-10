import { cn } from '@/lib/utils';
import type { ArtifactSourceState } from '@/lib/maintaineros/types';

const SOURCE_STYLES: Record<ArtifactSourceState, string> = {
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rehearsal: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  fixture: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  planned: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
};

export function EvidenceBadge({ sourceState, className }: { sourceState: ArtifactSourceState; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide', SOURCE_STYLES[sourceState], className)}>
      {sourceState}
    </span>
  );
}
