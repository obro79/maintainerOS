import { RepoAudit } from '@/components/blocks/repo-audit';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function AuditPage({ params }: Props) {
  const { org, repo } = await params;
  const dashboard = await getMaintainerOSRepository().getDashboard(`${org}/${repo}`);
  return <RepoAudit providerStatuses={dashboard.providerStatuses} />;
}
