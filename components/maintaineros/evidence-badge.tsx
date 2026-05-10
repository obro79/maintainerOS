import { cn } from '@/lib/utils';
import type { ArtifactSourceState } from '@/lib/maintaineros/types';

const SOURCE_STYLES: Record<ArtifactSourceState, string> = {
  live: 'border-[#3F72AF]/30 bg-[#3F72AF]/10 text-[#DBE2EF]',
  rehearsal: 'border-[#3F72AF]/30 bg-[#3F72AF]/10 text-[#DBE2EF]',
  fixture: 'border-[#DBE2EF]/30 bg-[#DBE2EF]/10 text-[#DBE2EF]',
  planned: 'border-[#DBE2EF]/30 bg-[#F9F7F7]/10 text-[#F9F7F7]/68',
};

export function EvidenceBadge({ sourceState, className }: { sourceState: ArtifactSourceState; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-sans uppercase tracking-wide', SOURCE_STYLES[sourceState], className)}>
      {sourceState}
    </span>
  );
}
