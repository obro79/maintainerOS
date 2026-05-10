import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const FALLBACK: Record<string, object[]> = {
  agent: [
    {
      number: 111,
      title: 'Add cursor-based pagination to /issues endpoint',
      labels: [{ name: 'enhancement', color: '0075ca' }, { name: 'api', color: 'e4e669' }],
      user: 'johndoe',
      daysAgo: 2,
    },
  ],
  review: [
    {
      number: 87,
      title: 'Upgrade path for v1→v2 webhook format',
      labels: [{ name: 'breaking-change', color: 'e11d48' }],
      user: 'maintainer',
      daysAgo: 10,
    },
  ],
  bounty: [
    {
      number: 112,
      title: 'Redis queue drains silently on OOM restart',
      labels: [{ name: 'infra', color: '0e8a16' }, { name: 'bug', color: 'd93f0b' }],
      user: 'reporter',
      daysAgo: 2,
    },
  ],
  clarify: [
    {
      number: 99,
      title: 'Clarify expected retry semantics on 408',
      labels: [{ name: 'question', color: 'd876e3' }],
      user: 'contributor',
      daysAgo: 5,
    },
  ],
};

export async function GET(request: NextRequest) {
  const lane = request.nextUrl.searchParams.get('lane') ?? '';
  const issues = FALLBACK[lane] ?? [];
  return NextResponse.json(issues);
}
