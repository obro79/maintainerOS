import { redirect } from 'next/navigation';

export const metadata = {
  title: 'MaintainerOS Live Repo',
  description: 'The public demo reset route now redirects to the live MaintainerOS product route.',
};

export default function DemoResetPage() {
  redirect('/vercel/next.js');
}
