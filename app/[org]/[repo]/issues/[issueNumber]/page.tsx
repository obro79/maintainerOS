import Link from 'next/link';
import { IssueArtifactStack } from '@/components/maintaineros/issue-artifact-stack';
import { PhaseShell } from '@/components/maintaineros/phase-shell';
import { RouteIssueButton } from '@/components/maintaineros/route-issue-button';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string; issueNumber: string }>;
}

export default async function IssuePage({ params }: Props) {
  const { org, repo, issueNumber } = await params;
  const repository = getMaintainerOSRepository();
  const [issue, dashboard] = await Promise.all([
    repository.getIssueDetail(`${org}/${repo}`, Number(issueNumber)),
    repository.getDashboard(`${org}/${repo}`),
  ]);

  return (
    <PhaseShell
      eyebrow={`${org}/${repo} · issue detail`}
      title={issue ? `#${issue.number} ${issue.title}` : `Issue #${issueNumber}`}
      description="Live-first artifact stack for route, work order, CLōD model run, Nia context, Daytona sandbox, Greptile verification, and Clustly release state."
      providerStatuses={dashboard.providerStatuses}
    >
      <div className="flex flex-wrap gap-2">
        <Link className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400" href={`/${org}/${repo}/issues/${issueNumber}/trace`}>
          View trace
        </Link>
        <Link className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400" href={`/${org}/${repo}/proof`}>
          View proof
        </Link>
      </div>
      {issue && <RouteIssueButton repositoryId={`${org}/${repo}`} issueNumber={Number(issueNumber)} />}
      <IssueArtifactStack issue={issue} />
    </PhaseShell>
  );
}
