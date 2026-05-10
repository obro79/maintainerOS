import { PhaseShell } from '@/components/maintaineros/phase-shell';
import { SandboxAttemptList } from '@/components/maintaineros/sandbox-attempt-list';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function AgentsPage({ params }: Props) {
  const { org, repo } = await params;
  const repository = getMaintainerOSRepository();
  const [attempts, dashboard] = await Promise.all([
    repository.getSandboxAttempts(`${org}/${repo}`),
    repository.getDashboard(`${org}/${repo}`),
  ]);
  return (
    <PhaseShell
      eyebrow={`${org}/${repo} · agents`}
      title="Sandboxed Agent Attempts"
      description="Daytona-style execution artifacts land here: sandbox IDs, context packs, commands, logs, files touched, PR links, and failure reasons."
      repository={dashboard.repository}
      providerStatuses={dashboard.providerStatuses}
    >
      <p className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs leading-relaxed text-amber-200">
        Sandbox success is execution evidence only. It records what ran, changed, and produced a PR artifact; Phase 5 verification decides correctness.
      </p>
      <SandboxAttemptList attempts={attempts} />
    </PhaseShell>
  );
}
