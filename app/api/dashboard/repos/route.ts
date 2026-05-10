import { NextResponse } from 'next/server';
import { hasNeonConnection, withPostgres } from '@/lib/maintaineros/postgres';

const FALLBACK_REPOS = [
  { id: 'acme/frontend', label: 'acme/frontend' },
  { id: 'acme/api', label: 'acme/api' },
];

interface RepositoryRow {
  id: string;
  full_name: string;
}

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.MAINTAINEROS_DATA_MODE !== 'live' || !hasNeonConnection()) {
    return NextResponse.json(FALLBACK_REPOS);
  }

  try {
    const repos = await withPostgres(async (client) => {
      const result = await client.query<RepositoryRow>(
        `select id, full_name
         from maintaineros_repositories
         order by imported_at desc nulls last, updated_at desc nulls last
         limit 20`,
      );
      return result.rows.map((repo) => ({ id: repo.id, label: repo.full_name }));
    });
    return NextResponse.json(repos.length > 0 ? repos : FALLBACK_REPOS);
  } catch {
    return NextResponse.json([]);
  }
}
