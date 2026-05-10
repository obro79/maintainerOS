import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROUTE_TO_LANE, type DemoLane } from '@/lib/maintaineros/types';
import { hasNeonConnection, withPostgres, type PgClient } from '@/lib/maintaineros/postgres';
import { scoreIssue } from '@/lib/maintaineros/routing';

interface RepositoryRow {
  id: string;
}

interface IssueRow {
  number: number;
  title: string;
  body: string;
  author: string;
  labels: string[] | string;
  labels_full: Array<{ name?: string | null; color?: string | null }> | string | null;
  comments_count: number;
  created_at: Date | string | null;
}

type LaneKey = 'agent' | 'review' | 'bounty' | 'clarify';

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
  if (!isLane(lane)) return NextResponse.json([]);

  if (process.env.MAINTAINEROS_DATA_MODE !== 'live' || !hasNeonConnection()) {
    return NextResponse.json(FALLBACK[lane] ?? []);
  }

  try {
    const repo = request.nextUrl.searchParams.get('repo') ?? '';
    const issues = await withPostgres(async (client) => {
      const repository = await findRepository(client, repo);
      const result = await client.query<IssueRow>(
        `select number, title, body, author, labels, labels_full, comments_count, created_at
         from maintaineros_issues
         where repository_id = $1 and state = 'open'
         order by updated_at desc nulls last, number desc
         limit 100`,
        [repository.id],
      );
      return result.rows
        .map(toDashboardIssue)
        .filter((issue) => issue.lane === lane)
        .map((issue) => ({
          number: issue.number,
          title: issue.title,
          labels: issue.labels,
          user: issue.user,
          daysAgo: issue.daysAgo,
        }));
    });
    return NextResponse.json(issues);
  } catch {
    return NextResponse.json([]);
  }
}

async function findRepository(client: PgClient, repo: string): Promise<RepositoryRow> {
  if (repo) {
    const result = await client.query<RepositoryRow>(
      `select id
       from maintaineros_repositories
       where lower(id) = lower($1) or lower(full_name) = lower($1)
       order by imported_at desc nulls last
       limit 1`,
      [repo],
    );
    if (result.rows[0]) return result.rows[0];
  }

  const latest = await client.query<RepositoryRow>(
    `select id
     from maintaineros_repositories
     order by imported_at desc nulls last, updated_at desc nulls last
     limit 1`,
  );
  if (!latest.rows[0]) throw new Error('No imported repositories found.');
  return latest.rows[0];
}

function toDashboardIssue(issue: IssueRow) {
  const labels = normalizeLabels(issue.labels);
  const decision = scoreIssue({
    title: issue.title,
    body: issue.body,
    labels,
    commentsCount: issue.comments_count,
  });
  const lane = normalizeLane(ROUTE_TO_LANE[decision.route]);

  return {
    lane,
    number: issue.number,
    title: issue.title,
    labels: labelBadges(issue.labels_full, labels),
    user: issue.author,
    daysAgo: daysAgo(issue.created_at),
  };
}

function isLane(value: string): value is LaneKey {
  return value === 'agent' || value === 'review' || value === 'bounty' || value === 'clarify';
}

function normalizeLane(lane: DemoLane): LaneKey {
  return lane === 'maintainer' ? 'review' : lane;
}

function normalizeLabels(labels: IssueRow['labels']) {
  if (Array.isArray(labels)) return labels;
  try {
    const parsed = JSON.parse(labels);
    return Array.isArray(parsed) ? parsed.filter((label): label is string => typeof label === 'string') : [];
  } catch {
    return [];
  }
}

function labelBadges(rawLabels: IssueRow['labels_full'], labels: string[]) {
  const fullLabels = normalizeFullLabels(rawLabels);
  if (fullLabels.length > 0) {
    return fullLabels.slice(0, 3).map((label) => ({
      name: label.name ?? 'label',
      color: label.color ?? colorForLabel(label.name ?? ''),
    }));
  }
  return labels.slice(0, 3).map((label) => ({ name: label, color: colorForLabel(label) }));
}

function normalizeFullLabels(rawLabels: IssueRow['labels_full']) {
  if (Array.isArray(rawLabels)) return rawLabels;
  if (!rawLabels) return [];
  try {
    const parsed = JSON.parse(rawLabels);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function colorForLabel(label: string) {
  const palette = ['3F72AF', 'DBE2EF', '112D4E', 'F9F7F7'];
  const index = [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function daysAgo(value: Date | string | null) {
  if (!value) return 0;
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / 86_400_000));
}
