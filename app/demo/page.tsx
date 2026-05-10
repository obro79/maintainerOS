import { redirect } from 'next/navigation';

export const metadata = {
  title: 'MaintainerOS Live Repo',
  description: 'The public demo now redirects to the live MaintainerOS product route.',
};

export default function Demo() {
  redirect('/vercel/next.js');
}
