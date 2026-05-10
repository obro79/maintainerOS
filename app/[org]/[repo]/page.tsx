import { RepoDashboard } from '@/components/blocks/repo-dashboard';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function RepoPage({ params }: Props) {
  const { org, repo } = await params;
  const dashboard = await getMaintainerOSRepository().getDashboard(`${org}/${repo}`);
  return <RepoDashboard org={org} repo={repo} dashboard={dashboard} />;
}
