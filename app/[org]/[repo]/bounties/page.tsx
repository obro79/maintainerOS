import { RepoBounties } from '@/components/blocks/repo-bounties';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function BountiesPage({ params }: Props) {
  const { org, repo } = await params;
  const repository = getMaintainerOSRepository();
  const [bounties, dashboard] = await Promise.all([
    repository.getBountyTasks(`${org}/${repo}`),
    repository.getDashboard(`${org}/${repo}`),
  ]);
  return <RepoBounties bounties={bounties} repository={dashboard.repository} providerStatuses={dashboard.providerStatuses} />;
}
