import Link from 'next/link';
import { PhaseShell } from '@/components/maintaineros/phase-shell';
import { TraceLedger } from '@/components/maintaineros/trace-ledger';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string; issueNumber: string }>;
}

export default async function IssueTracePage({ params }: Props) {
  const { org, repo, issueNumber } = await params;
  const repository = getMaintainerOSRepository();
  const [trace, dashboard] = await Promise.all([
    repository.getIssueTrace(`${org}/${repo}`, Number(issueNumber)),
    repository.getDashboard(`${org}/${repo}`),
  ]);

  return (
    <PhaseShell
      eyebrow={`${org}/${repo} · trace`}
      title={`Issue #${issueNumber} Trace`}
      description="Historical ledger for import, route, model run, context pack, sandbox attempts, verification, payout gates, and reroutes."
      repository={dashboard.repository}
      providerStatuses={dashboard.providerStatuses}
    >
      <Link className="rounded-lg border border-[#F9F7F7]/12 px-3 py-1.5 text-xs text-[#F9F7F7]/68" href={`/${org}/${repo}/issues/${issueNumber}`}>
        Back to issue
      </Link>
      <TraceLedger events={trace} />
    </PhaseShell>
  );
}
