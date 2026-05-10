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
const issues = await fetchIssues(owner, repo, limit);
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
        issue.body || "",
        issue.user?.login || "unknown",
        JSON.stringify(normalizeLabels(issue.labels)),
        issue.comments,
        issue.html_url,
        issue.state,
        issue.created_at,
        issue.updated_at,
        issue.closed_at
      ]
    );
  }

  for (const pullRequest of pullRequests) {
    await client.query(
      `insert into maintaineros_pull_requests
        (id, repository_id, number, title, body, author, branch_name, head_sha, base_branch, html_url, state, draft, merged_at, linked_issue_number, created_at, updated_at, closed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       on conflict (repository_id, number) do update set
        title = excluded.title,
        body = excluded.body,
        author = excluded.author,
        branch_name = excluded.branch_name,
        head_sha = excluded.head_sha,
        base_branch = excluded.base_branch,
        html_url = excluded.html_url,
        state = excluded.state,
        draft = excluded.draft,
        merged_at = excluded.merged_at,
        linked_issue_number = excluded.linked_issue_number,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        closed_at = excluded.closed_at`,
      [
        String(pullRequest.id),
        repositoryId,
        pullRequest.number,
        pullRequest.title,
        pullRequest.body || "",
        pullRequest.user?.login || "unknown",
        pullRequest.head?.ref || "",
        pullRequest.head?.sha || null,
        pullRequest.base?.ref || "",
        pullRequest.html_url,
        pullRequest.merged_at ? "merged" : pullRequest.state,
        Boolean(pullRequest.draft),
        pullRequest.merged_at,
        findLinkedIssueNumber(pullRequest.body || ""),
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
    [runId, issues.length, 0, pullRequests.length, issues.length > 0 || pullRequests.length > 0 ? "succeeded" : "partial", finishedAt.toISOString()]
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
  let page = 1;

  while (output.length < requestedLimit) {
    const perPage = 100;
    const pageIssues = await githubFetch(
      `https://api.github.com/repos/${ownerName}/${repoName}/issues?state=open&per_page=${perPage}&page=${page}`
    );

    for (const issue of pageIssues) {
      if (!issue.pull_request) output.push(issue);
    }

    if (pageIssues.length < perPage) break;
    page += 1;
  }

  return output.slice(0, requestedLimit);
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
      number integer not null,
      title text not null,
      body text not null default '',
      author text not null default 'unknown',
      branch_name text not null default '',
      head_sha text,
      base_branch text not null default '',
      html_url text not null,
      state text not null default 'open',
      draft boolean not null default false,
      merged_at timestamptz,
      linked_issue_number integer,
      created_at timestamptz,
      updated_at timestamptz,
      closed_at timestamptz,
      unique(repository_id, number)
    )
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
