import { cookies } from 'next/headers';
import { DemoPage } from '@/components/blocks/demo-page';
import { DEMO_SCENARIO_COOKIE, getDemoScenario } from '@/lib/maintaineros/demo-scenarios';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

export const metadata = {
  title: 'Live Demo — MaintainerOS',
  description: 'See 20 real issues routed in seconds. Agent, maintainer, bounty, or clarify — with CLOD rationale for each.',
};

export default async function Demo() {
  const cookieStore = await cookies();
  const scenario = getDemoScenario(cookieStore.get(DEMO_SCENARIO_COOKIE)?.value);
  const repository = getMaintainerOSRepository();
  const dashboard = await repository.getDashboard(scenario.repositoryId);
  const selectedIssue = await repository.getIssueDetail(scenario.repositoryId, scenario.targetIssueNumber);
  return <DemoPage dashboard={selectedIssue ? { ...dashboard, selectedIssue } : dashboard} />;
}
