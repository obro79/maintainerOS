import { cookies } from 'next/headers';
import { RepoDashboard } from '@/components/blocks/repo-dashboard';
import { DEMO_SCENARIO_COOKIE, getDemoScenario } from '@/lib/maintaineros/demo-scenarios';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function RepoPage({ params }: Props) {
  const { org, repo } = await params;
  const cookieStore = await cookies();
  const scenario = getDemoScenario(cookieStore.get(DEMO_SCENARIO_COOKIE)?.value);
  const repository = getMaintainerOSRepository();
  const dashboard = await repository.getDashboard(`${org}/${repo}`);
  const issueDetail =
    (await repository.getIssueDetail(`${org}/${repo}`, scenario.targetIssueNumber)) ?? dashboard.selectedIssue;
  return <RepoDashboard org={org} repo={repo} dashboard={{ ...dashboard, selectedIssue: issueDetail }} />;
}
