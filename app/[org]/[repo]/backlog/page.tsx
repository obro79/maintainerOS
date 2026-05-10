import { RepoBacklog } from '@/components/blocks/repo-backlog';

import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function BacklogPage({ params }: Props) {
  const { org, repo } = await params;
  const dashboard = await getMaintainerOSRepository().getDashboard(`${org}/${repo}`);
  return <RepoBacklog dashboard={dashboard} />;
}
