import { NextResponse } from 'next/server';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';
import { parsePullRequestReference } from '@/lib/maintaineros/verification';
import { withPostgres } from '@/lib/maintaineros/postgres';
import { persistPullRequest } from '@/lib/maintaineros/workflow-state';
import { recordTraceEvent } from '@/lib/maintaineros/trace-events';
import { recordProviderRun } from '@/lib/maintaineros/provider-runs';
import { authorizeWorkflowMutation } from '@/lib/maintaineros/auth';

export const runtime = 'nodejs';

interface GitHubPullRequestResponse {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  merged_at?: string | null;
  head: {
    ref: string;
    sha: string;
  };
  user: {
    login: string;
  } | null;
}

export async function POST(request: Request) {
  try {
    const authError = authorizeWorkflowMutation(request);
    if (authError) return NextResponse.json({ ok: false, error: authError }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const repositoryId = stringBody(body.repositoryId);
    const issueNumber = Number(body.issueNumber);
    const pullRequestUrl = stringBody(body.pullRequestUrl);
    if (!repositoryId || !Number.isInteger(issueNumber) || issueNumber < 1 || !pullRequestUrl) {
      return NextResponse.json({ ok: false, error: 'repositoryId, positive issueNumber, and pullRequestUrl are required.' }, { status: 400 });
    }

    const parsed = parsePullRequestReference(pullRequestUrl);
    if (!parsed) return NextResponse.json({ ok: false, error: 'pullRequestUrl must be a GitHub PR URL or owner/repo#number reference.' }, { status: 400 });
    if (`${parsed.owner}/${parsed.repo}`.toLowerCase() !== repositoryId.toLowerCase()) {
      return NextResponse.json({ ok: false, error: 'pullRequestUrl must belong to the requested repositoryId.' }, { status: 400 });
    }

    const issue = await getMaintainerOSRepository().getIssueDetail(repositoryId, issueNumber);
    if (!issue) return NextResponse.json({ ok: false, error: 'Issue not found.' }, { status: 404 });

    const startedAt = Date.now();
    const pullRequest = await fetchGitHubPullRequest(parsed.owner, parsed.repo, parsed.number);
    const prStatus = normalizePrStatus(pullRequest);
    const persisted = await withPostgres((client) => persistPullRequest(client, {
      repositoryId,
      issueNumber,
      number: pullRequest.number,
      title: pullRequest.title,
      branchName: pullRequest.head.ref,
      headSha: pullRequest.head.sha,
      status: prStatus,
      htmlUrl: pullRequest.html_url,
      authorLogin: pullRequest.user?.login ?? 'unknown',
    }));

    await recordProviderRun({
      provider: 'github',
      purpose: 'link-pr',
      status: 'succeeded',
      sourceState: 'live',
      repositoryId,
      issueNumber,
      runId: `github-pr-${parsed.owner}-${parsed.repo}-${parsed.number}`,
      artifactUrl: pullRequest.html_url,
      latencyMs: Date.now() - startedAt,
      responseMeta: { headSha: pullRequest.head.sha, status: prStatus },
    });
    await recordTraceEvent({
      repositoryId,
      issueNumber,
      actor: 'GitHub PR linker',
      provider: 'github',
      sourceState: 'live',
      route: issue.route,
      title: `PR #${pullRequest.number} linked`,
      detail: `${pullRequest.user?.login ?? 'unknown'} opened ${pullRequest.head.ref}; MaintainerOS tied the PR back to issue #${issueNumber}.`,
      status: prStatus === 'closed' ? 'blocked' : 'succeeded',
      artifactUrl: pullRequest.html_url,
      relatedId: pullRequest.head.sha,
      at: persisted.linkedAt,
    });

    return NextResponse.json({ ok: true, pullRequest: persisted.viewModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PR link error.';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('GitHub') ? 502 : 500 });
  }
}

async function fetchGitHubPullRequest(owner: string, repo: string, number: number): Promise<GitHubPullRequestResponse> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'MaintainerOS-link-pr',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, { headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GitHub PR fetch failed ${response.status}: ${payload?.message ?? response.statusText}`);
  return payload as GitHubPullRequestResponse;
}

function normalizePrStatus(pr: GitHubPullRequestResponse) {
  if (pr.merged_at) return 'merged' as const;
  if (pr.draft) return 'draft' as const;
  if (pr.state === 'closed') return 'closed' as const;
  return 'open' as const;
}

function stringBody(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}
