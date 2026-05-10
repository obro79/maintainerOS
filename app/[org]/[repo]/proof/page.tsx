import Link from 'next/link';
import { cookies } from 'next/headers';
import { PhaseShell } from '@/components/maintaineros/phase-shell';
import { SponsorProofPanel } from '@/components/maintaineros/sponsor-proof-panel';
import { DEMO_SCENARIO_COOKIE, getDemoScenario } from '@/lib/maintaineros/demo-scenarios';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';
import { mergeSponsorProof } from '@/lib/maintaineros/sponsor-proof';
import type { SponsorProofViewModel } from '@/lib/maintaineros/types';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function ProofPage({ params }: Props) {
  const { org, repo } = await params;
  const cookieStore = await cookies();
  const scenario = getDemoScenario(cookieStore.get(DEMO_SCENARIO_COOKIE)?.value);
  const dashboard = await getMaintainerOSRepository().getDashboard(`${org}/${repo}`);
  const proofItems = mergeSponsorProof(dashboard.sponsorProof);
  return (
    <PhaseShell
      eyebrow={`${org}/${repo} · proof`}
      title="Sponsor Proof"
      description="Judging evidence for every sponsor used inside the MaintainerOS product path."
      providerStatuses={dashboard.providerStatuses}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {proofItems.map((proof) => (
          <div key={proof.provider} className="space-y-2">
            <SponsorProofPanel proof={proof} />
            <Link className="inline-flex rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white" href={`/${org}/${repo}/issues/${scenario.targetIssueNumber}/trace#${proofTraceAnchor(proof.provider, scenario.traceAnchors)}`}>
              View trace evidence
            </Link>
          </div>
        ))}
      </div>
    </PhaseShell>
  );
}

function proofTraceAnchor(provider: SponsorProofViewModel['provider'], anchors: string[]) {
  const providerAnchor = anchors.find((anchor) => anchor.includes(provider));
  if (providerAnchor) return providerAnchor;
  if (provider === 'greptile') return 'issue-41-verification';
  if (provider === 'clustly') return 'issue-41-payout-gate';
  if (provider === 'daytona') return 'issue-41-attempt-1-dispatched';
  if (provider === 'nia') return 'issue-41-nia-context-trace';
  return 'issue-41-clod';
}
