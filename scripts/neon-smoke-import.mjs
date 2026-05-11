import pg from "pg";
import { existsSync, readFileSync } from "node:fs";

const { Pool } = pg;

loadEnvLocal();

const owner = process.env.GITHUB_IMPORT_OWNER || "vercel";
const repo = process.env.GITHUB_IMPORT_REPO || "next.js";
const limit = Number(process.env.NEON_SMOKE_IMPORT_LIMIT || process.env.GITHUB_IMPORT_LIMIT || "5000");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: Number(process.env.MAINTAINEROS_POSTGRES_CONNECTION_TIMEOUT_MS || "3000")
});

const githubHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "MaintainerOS-reference"
};

if (process.env.GITHUB_TOKEN) {
  githubHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const repository = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`);
const { issues, skippedPullRequestCount } = await fetchIssues(owner, repo, limit);
const pullRequests = await fetchPullRequests(owner, repo, limit);
const greptileCommentsByPullRequest = await fetchGreptileCommentsByPullRequest(owner, repo);
const repositoryId = `${owner}/${repo}`.toLowerCase();
const startedAt = new Date();
const runId = `github-${owner}-${repo}-${startedAt.getTime()}`.toLowerCase();
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await ensureMaintainerSchema(client);
  await client.query(
    `insert into maintaineros_import_runs
      (id, provider, owner, repo, requested_limit, status, source_state, started_at)
     values ($1, 'github', $2, $3, $4, 'pending', 'live', $5)`,
    [runId, owner, repo, limit, startedAt.toISOString()]
  );

  await client.query(
    `insert into maintaineros_repositories
      (id, provider, owner, name, full_name, html_url, open_issue_count, imported_at, updated_at)
     values ($1, 'github', $2, $3, $4, $5, $6, now(), now())
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
      repository.owner.login,
      repository.name,
      repository.full_name,
      repository.html_url,
      issues.length
    ]
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
        issue.body || "",
        issue.user?.login || "unknown",
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
        JSON.stringify(issue)
      ]
    );
  }

  for (const pullRequest of pullRequests) {
    const linkedIssueNumber = findLinkedIssueNumber(pullRequest.body || "");
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
        linkedIssueNumber || 0,
        pullRequest.number,
        pullRequest.title,
        pullRequest.body || "",
        pullRequest.user?.login || "unknown",
        pullRequest.head?.ref || "",
        pullRequest.head?.sha || "unknown",
        pullRequest.base?.ref || "",
        pullRequest.html_url,
        pullRequest.merged_at ? "merged" : pullRequest.state,
        Boolean(pullRequest.draft),
        pullRequest.merged_at,
        linkedIssueNumber,
        pullRequest.created_at,
        pullRequest.updated_at,
        pullRequest.closed_at
      ]
    );

    const greptileComments = greptileCommentsByPullRequest.get(pullRequest.number) || [];
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
          `${comment.kind || "comment"}-${comment.id}`,
          repositoryId,
          pullRequest.number,
          comment.user?.login || "unknown",
          comment.body || "",
          comment.html_url,
          comment.path || null,
          comment.line || null,
          comment.created_at,
          comment.updated_at
        ]
      );
    }
  }

  const finishedAt = new Date();
  await client.query(
    `update maintaineros_import_runs
     set imported_issue_count = $2,
         skipped_pull_request_count = $3,
         imported_pull_request_count = $4,
         status = $5,
         finished_at = $6
     where id = $1`,
    [runId, issues.length, skippedPullRequestCount, pullRequests.length, issues.length > 0 || pullRequests.length > 0 ? "succeeded" : "partial", finishedAt.toISOString()]
  );
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}

const counts = await pool.query(
  `select
	    (select count(*)::int from maintaineros_repositories where id = $1) as repositories,
	    (select count(*)::int from maintaineros_issues where repository_id = $1) as issues,
	    (select count(*)::int from maintaineros_pull_requests where repository_id = $1) as pull_requests,
	    (select count(*)::int from maintaineros_pull_request_comments where repository_id = $1) as pull_request_comments,
	    (select count(*)::int from maintaineros_import_runs where lower(owner) = lower($2) and lower(repo) = lower($3)) as import_runs`,
  [repositoryId, owner, repo]
);

console.log(
  JSON.stringify(
    {
      ok: true,
      imported: {
        fullName: `${owner}/${repo}`,
        requestedLimit: limit,
        importedIssues: issues.length,
        skippedPullRequests: skippedPullRequestCount,
        importedPullRequests: pullRequests.length,
        repositoryId
      },
      counts: counts.rows[0]
    },
    null,
    2
  )
);

await pool.end();

async function fetchIssues(ownerName, repoName, requestedLimit) {
  const output = [];
  let skippedPullRequestCount = 0;
  let page = 1;

  while (output.length < requestedLimit) {
    const perPage = 100;
    const pageIssues = await githubFetch(
      `https://api.github.com/repos/${ownerName}/${repoName}/issues?state=open&sort=created&direction=desc&per_page=${perPage}&page=${page}`
    );

    for (const issue of pageIssues) {
      if (issue.pull_request) {
        skippedPullRequestCount += 1;
      } else {
        output.push(issue);
      }
    }

    if (pageIssues.length < perPage) break;
    page += 1;
  }

  return { issues: output.slice(0, requestedLimit), skippedPullRequestCount };
}

async function fetchPullRequests(ownerName, repoName, requestedLimit) {
  const output = [];
  let page = 1;

  while (output.length < requestedLimit) {
    const perPage = 100;
    const pagePullRequests = await githubFetch(
      `https://api.github.com/repos/${ownerName}/${repoName}/pulls?state=open&per_page=${perPage}&page=${page}`
    );
    output.push(...pagePullRequests.slice(0, requestedLimit - output.length));
    if (pagePullRequests.length < perPage) break;
    page += 1;
  }

  return output;
}

async function fetchGreptileCommentsByPullRequest(ownerName, repoName) {
  const [issueComments, reviewComments] = await Promise.all([
    fetchCommentPages(`https://api.github.com/repos/${ownerName}/${repoName}/issues/comments`, "issue"),
    fetchCommentPages(`https://api.github.com/repos/${ownerName}/${repoName}/pulls/comments`, "review")
  ]);
  const grouped = new Map();
  for (const comment of [...issueComments, ...reviewComments].filter(isGreptileComment)) {
    const pullRequestNumber = pullRequestNumberForComment(comment);
    if (!pullRequestNumber) continue;
    const comments = grouped.get(pullRequestNumber) || [];
    comments.push(comment);
    grouped.set(pullRequestNumber, comments);
  }
  return grouped;
}

async function fetchCommentPages(url, kind) {
  const comments = [];
  let page = 1;

  while (page <= 10) {
    const payload = await githubFetch(`${url}?per_page=100&page=${page}`);
    comments.push(...payload.map((comment) => ({ ...comment, kind })));
    if (payload.length < 100) break;
    page += 1;
  }

  return comments;
}

async function githubFetch(url) {
  const response = await fetch(url, { headers: githubHeaders });
  if (!response.ok) {
    throw new Error(`GitHub request failed ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function normalizeLabels(labels) {
  return labels.flatMap((label) => (typeof label === "string" ? [label] : label.name ? [label.name] : []));
}

function issueMetadata(issue) {
  return {
    author: issue.user
      ? {
          login: issue.user.login,
          id: issue.user.id ?? null,
          htmlUrl: issue.user.html_url ?? null,
          type: issue.user.type ?? null
        }
      : null,
    assignees: (issue.assignees ?? []).map((assignee) => ({
      login: assignee.login,
      id: assignee.id ?? null,
      htmlUrl: assignee.html_url ?? null,
      type: assignee.type ?? null
    })),
    labelsFull: issue.labels.map((label) => (typeof label === "string" ? { name: label } : label))
  };
}

function isGreptileComment(comment) {
  const author = comment.user?.login.toLowerCase() || "";
  const body = comment.body?.toLowerCase() || "";
  return author.includes("greptile") || body.includes("greptile");
}

function findLinkedIssueNumber(body) {
  const match = body.match(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i);
  return match ? Number(match[1]) : null;
}

function pullRequestNumberForComment(comment) {
  const url = comment.pull_request_url || comment.issue_url || comment.html_url;
  const match = url.match(/\/(?:pulls|issues|pull)\/(\d+)(?:$|[#/?])/);
  return match ? Number(match[1]) : null;
}

async function ensureMaintainerSchema(client) {
  await client.query(`
    create table if not exists maintaineros_repositories (
      id text primary key,
      provider text not null default 'github',
      owner text not null,
      name text not null,
      full_name text not null,
      html_url text not null,
      open_issue_count integer not null default 0,
      imported_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create table if not exists maintaineros_issues (
      id text primary key,
      repository_id text not null references maintaineros_repositories(id) on delete cascade,
      number integer not null,
      title text not null,
      body text not null default '',
      author text not null,
      labels jsonb not null default '[]'::jsonb,
      comments_count integer not null default 0,
      html_url text not null,
      state text not null default 'open',
      created_at timestamptz,
      updated_at timestamptz,
      closed_at timestamptz,
      unique(repository_id, number)
    )
  `);

  await client.query(`
    alter table maintaineros_issues
      add column if not exists provider_issue_id text,
      add column if not exists node_id text,
      add column if not exists author_metadata jsonb not null default '{}'::jsonb,
      add column if not exists author_association text,
      add column if not exists assignees jsonb not null default '[]'::jsonb,
      add column if not exists milestone jsonb,
      add column if not exists labels_full jsonb not null default '[]'::jsonb,
      add column if not exists reactions jsonb,
      add column if not exists comments_url text,
      add column if not exists events_url text,
      add column if not exists timeline_url text,
      add column if not exists repository_url text,
      add column if not exists api_url text,
      add column if not exists state_reason text,
      add column if not exists locked boolean not null default false,
      add column if not exists active_lock_reason text,
      add column if not exists raw_payload jsonb not null default '{}'::jsonb
  `);

  await client.query(`
    create table if not exists maintaineros_import_runs (
      id text primary key,
      provider text not null default 'github',
      owner text not null,
      repo text not null,
      requested_limit integer not null,
      imported_issue_count integer not null default 0,
      imported_pull_request_count integer not null default 0,
      skipped_pull_request_count integer not null default 0,
      status text not null,
      source_state text not null default 'live',
      started_at timestamptz not null,
      finished_at timestamptz,
      error_message text
    )
  `);

  await client.query(`
    alter table maintaineros_import_runs
      add column if not exists imported_pull_request_count integer not null default 0
  `);

	  await client.query(`
	    create table if not exists maintaineros_pull_requests (
	      id text primary key,
	      repository_id text not null references maintaineros_repositories(id) on delete cascade,
	      issue_number integer not null default 0,
	      number integer not null,
	      title text not null,
	      body text not null default '',
	      author text not null default 'unknown',
	      author_login text not null default 'unknown',
	      branch_name text not null default '',
	      head_sha text not null default 'unknown',
	      base_branch text not null default '',
	      html_url text not null,
	      status text not null default 'open',
	      draft boolean not null default false,
	      merged_at timestamptz,
	      linked_issue_number integer,
	      linked_at timestamptz,
	      created_at timestamptz,
	      updated_at timestamptz,
	      closed_at timestamptz,
	      unique(repository_id, number)
	    )
	  `);

  await client.query(`
    alter table maintaineros_pull_requests
      add column if not exists issue_number integer not null default 0,
      add column if not exists body text not null default '',
      add column if not exists author text not null default 'unknown',
      add column if not exists author_login text not null default 'unknown',
      add column if not exists head_sha text not null default 'unknown',
      add column if not exists status text not null default 'open',
      add column if not exists draft boolean not null default false,
      add column if not exists linked_issue_number integer,
      add column if not exists linked_at timestamptz
  `);

  await client.query(`
    create table if not exists maintaineros_pull_request_comments (
      id text primary key,
      repository_id text not null references maintaineros_repositories(id) on delete cascade,
      pull_request_number integer not null,
      provider text not null default 'greptile',
      author text not null default 'unknown',
      body text not null default '',
      html_url text not null,
      path text,
      line integer,
      created_at timestamptz,
      updated_at timestamptz,
      unique(repository_id, pull_request_number, id)
    )
  `);
}

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;

  const lines = readFileSync(".env.local", "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] ??= value;
  }
}
