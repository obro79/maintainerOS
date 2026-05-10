import { RepoSidebar } from '@/components/layout/repo-sidebar';

interface Props {
  children: React.ReactNode;
  params: Promise<{ org: string; repo: string }>;
}

export default async function RepoLayout({ children, params }: Props) {
  const { org, repo } = await params;
  return (
    <div className="flex min-h-screen bg-[#030509] text-white">
      <RepoSidebar org={org} repo={repo} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
