import type { ImportRunViewModel } from './types';
import { withPostgres } from './postgres';
import { recordTraceEvent } from './trace-events';

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

export interface ImportGitHubInput {
  owner: string;
  repo: string;
  limit: number;
}

export function validateImportInput(input: Partial<ImportGitHubInput>): ImportGitHubInput {
  const owner = input.owner?.trim();
  const repo = input.repo?.trim();
  const limit = Number(input.limit ?? 100);

  if (!owner || !/^[a-zA-Z0-9_.-]+$/.test(owner)) {
    throw new Error('owner must be a GitHub owner name.');
  }
  if (!repo || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
    throw new Error('repo must be a GitHub repository name.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer from 1 to 100.');
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

      await Promise.all(issues.map((issue) => recordTraceEvent({
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
      })));

      const status: ImportRunViewModel['status'] = issues.length > 0 ? 'succeeded' : 'partial';
      await client.query(
        `update maintaineros_import_runs
         set imported_issue_count = $2,
             skipped_pull_request_count = $3,
             status = $4,
             finished_at = $5
         where id = $1`,
        [runId, issues.length, skippedPullRequestCount, status, finishedAt.toISOString()],
      );

      return {
        id: runId,
        provider: 'github',
        owner: input.owner,
        repo: input.repo,
        requestedLimit: input.limit,
        importedIssueCount: issues.length,
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
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'MaintainerOS-Hackathon',
      },
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
