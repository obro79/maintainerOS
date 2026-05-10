import type { ImportRunViewModel } from './types';
import { withPostgres } from './postgres';
import { recordTraceEvent } from './trace-events';
import { GITHUB_IMPORT_DEFAULT_LIMIT, GITHUB_IMPORT_MAX_LIMIT } from './limits';

interface GitHubIssueResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  labels: Array<string | { name?: string | null }>;
  comments: number;
  html_url: string;
  state: string;
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
      const { issues, skippedPullRequestCount } = await fetchIssues(input.owner, input.repo, input.limit, token);
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
        await client.query(
          `insert into maintaineros_issues
            (id, repository_id, number, title, body, author, labels, comments_count, html_url, state, created_at, updated_at, closed_at)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
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
            closed_at = excluded.closed_at`,
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
          ],
        );
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

function normalizeLabels(labels: GitHubIssueResponse['labels']) {
  return labels
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter((label): label is string => Boolean(label));
}

async function fetchIssues(owner: string, repo: string, requestedLimit: number, token?: string) {
  const issues: GitHubIssueResponse[] = [];
  let skippedPullRequestCount = 0;
  let page = 1;

  while (issues.length < requestedLimit) {
    const perPage = 100;
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=${perPage}&page=${page}`, {
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
    skippedPullRequestCount += payload.filter((issue) => issue.pull_request).length;

    for (const issue of payload) {
      if (issue.pull_request) continue;
      issues.push(issue);
      if (issues.length >= requestedLimit) break;
    }

    if (payload.length < perPage) break;
    page += 1;
  }

  return { issues, skippedPullRequestCount };
}
