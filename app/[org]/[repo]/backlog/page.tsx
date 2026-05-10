import { RepoBacklog } from '@/components/blocks/repo-backlog';

import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string }>;
  searchParams: Promise<{ lane?: string }>;
}

export default async function BacklogPage({ params, searchParams }: Props) {
  const { org, repo } = await params;
  const { lane } = await searchParams;
  const dashboard = await getMaintainerOSRepository().getDashboard(`${org}/${repo}`);
  return <RepoBacklog dashboard={dashboard} initialLane={lane} />;
}
