import { EvidenceBadge } from './evidence-badge';
import type React from 'react';
import type { SponsorProofViewModel } from '@/lib/maintaineros/types';

const DEMO_RELEVANCE: Record<SponsorProofViewModel['provider'], string> = {
  github: 'Shows the source issue and PR evidence MaintainerOS routes from.',
  neon: 'Shows whether the demo is reading durable live data or falling back to fixtures.',
  clod: 'Shows the model, tier, cost, and routing artifact behind the work order.',
  nia: 'Shows the context citations that explain why the retry has better evidence.',
  daytona: 'Shows sandbox execution, command output, touched files, and PR handoff.',
  greptile: 'Shows the verification boundary for completion, stale proof, and payout.',
  clustly: 'Shows task funding, claim state, release readiness, and payout gate state.',
};

export function SponsorProofPanel({ proof }: { proof: SponsorProofViewModel }) {
  return (
    <section className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-sans uppercase tracking-[0.2em] text-[#F9F7F7]/40">{proof.provider}</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{proof.title}</h3>
        </div>
        <EvidenceBadge sourceState={proof.sourceState} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[#F9F7F7]/56">{proof.summary}</p>
      <p className="mt-2 rounded-lg border border-[#F9F7F7]/10 bg-[#F9F7F7]/[0.025] px-3 py-2 text-xs leading-relaxed text-[#F9F7F7]/56">
        Demo relevance: {DEMO_RELEVANCE[proof.provider]}
      </p>
      <p className="mt-3 text-xs text-[#F9F7F7]/40">
        Status: {proof.status}{proof.runId ? ` · Run: ${proof.runId}` : ''}{proof.occurredAt ? ` · ${new Date(proof.occurredAt).toISOString()}` : ''}
      </p>
      {(proof.artifactUrl || proof.screenshotUrl || proof.logUrl) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {proof.artifactUrl && <ProofLink href={proof.artifactUrl}>Artifact</ProofLink>}
          {proof.screenshotUrl && <ProofLink href={proof.screenshotUrl}>Screenshot</ProofLink>}
          {proof.logUrl && <ProofLink href={proof.logUrl}>Log</ProofLink>}
        </div>
      )}
    </section>
  );
}

function ProofLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="inline-flex rounded-lg border border-[#F9F7F7]/12 px-2 py-1 text-xs text-[#DBE2EF] hover:text-[#DBE2EF]" href={href}>
      {children}
    </a>
  );
}
