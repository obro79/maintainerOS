import { PhaseShell } from '@/components/maintaineros/phase-shell';
import { VerificationQueue } from '@/components/maintaineros/verification-queue';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function VerificationPage({ params }: Props) {
  const { org, repo } = await params;
  const repository = getMaintainerOSRepository();
  const [items, dashboard] = await Promise.all([
    repository.getVerificationQueue(`${org}/${repo}`),
    repository.getDashboard(`${org}/${repo}`),
  ]);
  return (
    <PhaseShell
      eyebrow={`${org}/${repo} · verification`}
      title="Greptile Verification"
      description="Verification queue for pending, passed, failed, and stale PR proof bundles."
      repository={dashboard.repository}
      providerStatuses={dashboard.providerStatuses}
    >
      <p className="rounded-xl border border-blue-500/20 bg-blue-500/8 p-3 text-xs leading-relaxed text-blue-200">
        Greptile is the completion trust boundary. Linked PRs, sandbox logs, and merged status are evidence, but only fresh passed verification can unblock completion or payout.
      </p>
      <VerificationQueue items={items} />
    </PhaseShell>
  );
}
