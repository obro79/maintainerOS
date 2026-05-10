import { EvidenceBadge } from './evidence-badge';
import type { SponsorProofViewModel } from '@/lib/maintaineros/types';

export function SponsorProofPanel({ proof }: { proof: SponsorProofViewModel }) {
  return (
    <section className="rounded-xl border border-white/8 bg-[#080d14] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-600">{proof.provider}</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{proof.title}</h3>
        </div>
        <EvidenceBadge sourceState={proof.sourceState} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-zinc-500">{proof.summary}</p>
      <p className="mt-3 text-xs text-zinc-600">Status: {proof.status}{proof.runId ? ` · Run: ${proof.runId}` : ''}</p>
    </section>
  );
}
