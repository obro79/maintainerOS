import type { ImportRunViewModel } from './types';
import { withPostgres } from './postgres';
import { recordTraceEvent } from './trace-events';
import { GITHUB_IMPORT_DEFAULT_LIMIT, GITHUB_IMPORT_MAX_LIMIT } from './limits';

interface GitHubIssueResponse {
  id: number;
  node_id?: string;
  number: number;
  title: string;
  body: string | null;
  user: { login: string; id?: number; html_url?: string; type?: string } | null;
  labels: Array<string | { id?: number; node_id?: string; name?: string | null; color?: string | null; description?: string | null; default?: boolean }>;
  assignees?: Array<{ login: string; id?: number; html_url?: string; type?: string }>;
  milestone?: Record<string, unknown> | null;
  reactions?: Record<string, unknown>;
  comments: number;
  comments_url?: string;
  events_url?: string;
  timeline_url?: string;
  repository_url?: string;
  url?: string;
  html_url: string;
  state: string;
  state_reason?: string | null;
  author_association?: string;
  locked?: boolean;
  active_lock_reason?: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: unknown;
}

interface GitHubPullRequestResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  html_url: string;
  state: string;
  draft?: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  head?: { ref?: string | null; sha?: string | null };
  base?: { ref?: string | null };
}

interface GitHubCommentResponse {
  id: number;
  user: { login: string } | null;
  body: string | null;
  html_url: string;
  issue_url?: string;
  pull_request_url?: string;
  path?: string | null;
  line?: number | null;
  created_at: string;
  updated_at: string;
  kind?: 'issue' | 'review';
}

const githubHeaders = (token?: string) => ({
  Accept: 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'MaintainerOS-Hackathon',
});

export interface ImportGitHubInput {
  owner: string;
  repo: string;
  limit: number;
}

export function validateImportInput(input: Partial<ImportGitHubInput>): ImportGitHubInput {
  const owner = input.owner?.trim();
  const repo = input.repo?.trim();
  const limit = Number(input.limit ?? GITHUB_IMPORT_DEFAULT_LIMIT);

  if (!owner || !/^[a-zA-Z0-9_.-]+$/.test(owner)) {
    throw new Error('owner must be a GitHub owner name.');
  }
  if (!repo || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
    throw new Error('repo must be a GitHub repository name.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > GITHUB_IMPORT_MAX_LIMIT) {
    throw new Error(`limit must be an integer from 1 to ${GITHUB_IMPORT_MAX_LIMIT}.`);
  }

  return { owner, repo, limit };
}

export async function importGitHubIssues(input: ImportGitHubInput): Promise<ImportRunViewModel> {
  const token = process.env.GITHUB_TOKEN;
  const startedAt = new Date();
  const runId = `github-${input.owner}-${input.repo}-${startedAt.getTime()}`.toLowerCase();

  return withPostgres(async (client) => {
    await client.query(
      `insert into maintaineros_import_runs
        (id, provider, owner, repo, requested_limit, status, source_state, started_at)
       values ($1, 'github', $2, $3, $4, 'pending', 'live', $5)`,
      [runId, input.owner, input.repo, input.limit, startedAt.toISOString()],
    );

    try {
      const { issues, skippedPullRequestCount } = await fetchIssues(input, token);
      const pullRequests = await fetchPullRequests(input.owner, input.repo, input.limit, token);
      const greptileCommentsByPullRequest = await fetchGreptileCommentsByPullRequest(input.owner, input.repo, token);
      const repositoryId = `${input.owner}/${input.repo}`.toLowerCase();
      const finishedAt = new Date();

      await client.query(
        `insert into maintaineros_repositories
          (id, provider, owner, name, full_name, html_url, open_issue_count, imported_at, updated_at)
         values ($1, 'github', $2, $3, $4, $5, $6, $7, $7)
         on conflict (id) do update set
          owner = excluded.owner,
          name = excluded.name,
          full_name = excluded.full_name,
          html_url = excluded.html_url,
          open_issue_count = excluded.open_issue_count,
          imported_at = excluded.imported_at,
          updated_at = excluded.updated_at`,
        [
          repositoryId,
          input.owner,
          input.repo,
          `${input.owner}/${input.repo}`,
          `https://github.com/${input.owner}/${input.repo}`,
          issues.length,
          finishedAt.toISOString(),
        ],
      );

      for (const issue of issues) {
        const metadata = issueMetadata(issue);
        await client.query(
          `insert into maintaineros_issues
            (id, repository_id, number, title, body, author, labels, comments_count, html_url, state, created_at, updated_at, closed_at,
             provider_issue_id, node_id, author_metadata, author_association, assignees, milestone, labels_full, reactions,
             comments_url, events_url, timeline_url, repository_url, api_url, state_reason, locked, active_lock_reason, raw_payload)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13,
             $14, $15, $16::jsonb, $17, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb,
             $22, $23, $24, $25, $26, $27, $28, $29, $30::jsonb)
           on conflict (repository_id, number) do update set
            title = excluded.title,
            body = excluded.body,
            author = excluded.author,
            labels = excluded.labels,
            comments_count = excluded.comments_count,
            html_url = excluded.html_url,
            state = excluded.state,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            closed_at = excluded.closed_at,
            provider_issue_id = excluded.provider_issue_id,
            node_id = excluded.node_id,
            author_metadata = excluded.author_metadata,
            author_association = excluded.author_association,
            assignees = excluded.assignees,
            milestone = excluded.milestone,
            labels_full = excluded.labels_full,
            reactions = excluded.reactions,
            comments_url = excluded.comments_url,
            events_url = excluded.events_url,
            timeline_url = excluded.timeline_url,
            repository_url = excluded.repository_url,
            api_url = excluded.api_url,
            state_reason = excluded.state_reason,
            locked = excluded.locked,
            active_lock_reason = excluded.active_lock_reason,
            raw_payload = excluded.raw_payload`,
          [
            String(issue.id),
            repositoryId,
            issue.number,
            issue.title,
            issue.body ?? '',
            issue.user?.login ?? 'unknown',
            JSON.stringify(normalizeLabels(issue.labels)),
            issue.comments,
            issue.html_url,
            issue.state,
            issue.created_at,
            issue.updated_at,
            issue.closed_at,
            String(issue.id),
            issue.node_id ?? null,
            JSON.stringify(metadata.author),
            issue.author_association ?? null,
            JSON.stringify(metadata.assignees),
            JSON.stringify(issue.milestone ?? null),
            JSON.stringify(metadata.labelsFull),
            JSON.stringify(issue.reactions ?? null),
            issue.comments_url ?? null,
            issue.events_url ?? null,
            issue.timeline_url ?? null,
            issue.repository_url ?? null,
            issue.url ?? null,
            issue.state_reason ?? null,
            issue.locked ?? false,
            issue.active_lock_reason ?? null,
            JSON.stringify(issue),
          ],
        );
      }

      for (const pullRequest of pullRequests) {
        const linkedIssueNumber = findLinkedIssueNumber(pullRequest.body ?? '');
        await client.query(
          `insert into maintaineros_pull_requests
            (id, repository_id, issue_number, number, title, body, author, author_login, branch_name, head_sha, base_branch, html_url, status, draft, merged_at, linked_issue_number, linked_at, created_at, updated_at, closed_at)
           values ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, $17, $18)
           on conflict (repository_id, number) do update set
            title = excluded.title,
            body = excluded.body,
            author = excluded.author,
            author_login = excluded.author_login,
            branch_name = excluded.branch_name,
            head_sha = excluded.head_sha,
            base_branch = excluded.base_branch,
            html_url = excluded.html_url,
            status = excluded.status,
            draft = excluded.draft,
            merged_at = excluded.merged_at,
            linked_issue_number = excluded.linked_issue_number,
            linked_at = excluded.linked_at,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            closed_at = excluded.closed_at`,
          [
            String(pullRequest.id),
            repositoryId,
            linkedIssueNumber ?? 0,
            pullRequest.number,
            pullRequest.title,
            pullRequest.body ?? '',
            pullRequest.user?.login ?? 'unknown',
            pullRequest.head?.ref ?? '',
            pullRequest.head?.sha ?? 'unknown',
            pullRequest.base?.ref ?? '',
            pullRequest.html_url,
            pullRequest.merged_at ? 'merged' : pullRequest.state,
            Boolean(pullRequest.draft),
            pullRequest.merged_at,
            linkedIssueNumber,
            pullRequest.created_at,
            pullRequest.updated_at,
            pullRequest.closed_at,
          ],
        );

        const greptileComments = greptileCommentsByPullRequest.get(pullRequest.number) ?? [];
        for (const comment of greptileComments) {
          await client.query(
            `insert into maintaineros_pull_request_comments
              (id, repository_id, pull_request_number, provider, author, body, html_url, path, line, created_at, updated_at)
             values ($1, $2, $3, 'greptile', $4, $5, $6, $7, $8, $9, $10)
             on conflict (repository_id, pull_request_number, id) do update set
              author = excluded.author,
              body = excluded.body,
              html_url = excluded.html_url,
              path = excluded.path,
              line = excluded.line,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at`,
            [
              `${comment.kind ?? 'comment'}-${comment.id}`,
              repositoryId,
              pullRequest.number,
              comment.user?.login ?? 'unknown',
              comment.body ?? '',
              comment.html_url,
              comment.path ?? null,
              comment.line ?? null,
              comment.created_at,
              comment.updated_at,
            ],
          );
        }
      }

      for (const issue of issues) {
        await recordTraceEvent({
          id: `${repositoryId}-${issue.number}-github-import-${runId}`,
          repositoryId,
          issueNumber: issue.number,
          actor: 'GitHub import',
          provider: 'github',
          sourceState: 'live',
          title: `Imported issue #${issue.number}`,
          detail: 'Live GitHub issue metadata, labels, author, timestamps, URL, and body were persisted.',
          status: 'succeeded',
          artifactUrl: issue.html_url,
          relatedId: runId,
          at: finishedAt.toISOString(),
          payload: {
            runId,
            owner: input.owner,
            repo: input.repo,
            skippedPullRequestCount,
          },
        });
      }

      const status: ImportRunViewModel['status'] = issues.length > 0 ? 'succeeded' : 'partial';
      await client.query(
        `update maintaineros_import_runs
         set imported_issue_count = $2,
             skipped_pull_request_count = $3,
             imported_pull_request_count = $4,
             status = $5,
             finished_at = $6
         where id = $1`,
        [runId, issues.length, skippedPullRequestCount, pullRequests.length, status, finishedAt.toISOString()],
      );

      return {
        id: runId,
        provider: 'github',
        owner: input.owner,
        repo: input.repo,
        requestedLimit: input.limit,
        importedIssueCount: issues.length,
        importedPullRequestCount: pullRequests.length,
        skippedPullRequestCount,
        status,
        sourceState: 'live',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        errorMessage: null,
      };
    } catch (error) {
      const finishedAt = new Date();
      const message = error instanceof Error ? error.message : 'Unknown GitHub import failure.';
      await client.query(
        `update maintaineros_import_runs
         set status = 'failed',
             finished_at = $2,
             error_message = $3
         where id = $1`,
        [runId, finishedAt.toISOString(), message],
      );
      throw error;
    }
  });
}

async function fetchIssues(input: ImportGitHubInput, token: string | undefined) {
  const issues: GitHubIssueResponse[] = [];
  let skippedPullRequestCount = 0;
  let page = 1;

  while (issues.length < input.limit) {
    const response = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/issues?state=open&sort=created&direction=desc&per_page=100&page=${page}`, {
      headers: githubHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`GitHub import failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GitHubIssueResponse[];
    for (const issue of payload) {
      if (issue.pull_request) {
        skippedPullRequestCount += 1;
      } else {
        issues.push(issue);
      }
      if (issues.length >= input.limit) break;
    }

    if (payload.length < 100) break;
    page += 1;
  }

  return { issues: issues.slice(0, input.limit), skippedPullRequestCount };
}

function normalizeLabels(labels: GitHubIssueResponse['labels']) {
  return labels
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter((label): label is string => Boolean(label));
}

function issueMetadata(issue: GitHubIssueResponse) {
  return {
    author: issue.user
      ? {
          login: issue.user.login,
          id: issue.user.id ?? null,
          htmlUrl: issue.user.html_url ?? null,
          type: issue.user.type ?? null,
        }
      : null,
    assignees: (issue.assignees ?? []).map((assignee) => ({
      login: assignee.login,
      id: assignee.id ?? null,
      htmlUrl: assignee.html_url ?? null,
      type: assignee.type ?? null,
    })),
    labelsFull: issue.labels.map((label) => (typeof label === 'string' ? { name: label } : label)),
  };
}

async function fetchPullRequests(owner: string, repo: string, requestedLimit: number, token?: string) {
  const pullRequests: GitHubPullRequestResponse[] = [];
  let page = 1;

  while (pullRequests.length < requestedLimit) {
    const perPage = 100;
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=${perPage}&page=${page}`, {
      headers: githubHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`GitHub PR import failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GitHubPullRequestResponse[];
    pullRequests.push(...payload.slice(0, requestedLimit - pullRequests.length));

    if (payload.length < perPage) break;
    page += 1;
  }

  return pullRequests;
}

async function fetchGreptileCommentsByPullRequest(owner: string, repo: string, token?: string) {
  const [issueComments, reviewComments] = await Promise.all([
    fetchCommentPages(`https://api.github.com/repos/${owner}/${repo}/issues/comments`, token, 'issue'),
    fetchCommentPages(`https://api.github.com/repos/${owner}/${repo}/pulls/comments`, token, 'review'),
  ]);
  const grouped = new Map<number, GitHubCommentResponse[]>();
  for (const comment of [...issueComments, ...reviewComments].filter(isGreptileComment)) {
    const pullRequestNumber = pullRequestNumberForComment(comment);
    if (!pullRequestNumber) continue;
    const comments = grouped.get(pullRequestNumber) ?? [];
    comments.push(comment);
    grouped.set(pullRequestNumber, comments);
  }
  return grouped;
}

async function fetchCommentPages(url: string, token: string | undefined, kind: GitHubCommentResponse['kind']) {
  const comments: GitHubCommentResponse[] = [];
  let page = 1;

  while (page <= 10) {
    const response = await fetch(`${url}?per_page=100&page=${page}`, { headers: githubHeaders(token) });
    if (!response.ok) return comments;
    const payload = (await response.json()) as GitHubCommentResponse[];
    comments.push(...payload.map((comment) => ({ ...comment, kind })));
    if (payload.length < 100) break;
    page += 1;
  }

  return comments;
}

function isGreptileComment(comment: GitHubCommentResponse) {
  const author = comment.user?.login.toLowerCase() ?? '';
  const body = comment.body?.toLowerCase() ?? '';
  return author.includes('greptile') || body.includes('greptile');
}

function findLinkedIssueNumber(body: string) {
  const match = body.match(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i);
  return match ? Number(match[1]) : null;
}

function pullRequestNumberForComment(comment: GitHubCommentResponse) {
  const url = comment.pull_request_url ?? comment.issue_url ?? comment.html_url;
  const match = url.match(/\/(?:pulls|issues|pull)\/(\d+)(?:$|[#/?])/);
  return match ? Number(match[1]) : null;
}
