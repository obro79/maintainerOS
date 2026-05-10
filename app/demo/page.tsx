import { DemoPage } from '@/components/blocks/demo-page';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

export const metadata = {
  title: 'Live Demo — MaintainerOS',
  description: 'See 20 real issues routed in seconds. Agent, maintainer, bounty, or clarify — with CLOD rationale for each.',
};

export default async function Demo() {
  const repository = getMaintainerOSRepository();
  const dashboard = await repository.getDashboard();
  return <DemoPage dashboard={dashboard} />;
}
