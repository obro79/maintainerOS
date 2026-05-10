import type {
  BountyViewModel,
  PaymentArtifactViewModel,
  PullRequestViewModel,
  VerificationViewModel,
} from './types';
import type { PgClient } from './postgres';
import { isVerificationStale } from './verification';

export interface WorkflowArtifacts {
  pullRequest: PullRequestViewModel | null;
  verification: VerificationViewModel | null;
  bounty: BountyViewModel | null;
  paymentArtifact: PaymentArtifactViewModel | null;
}

interface PullRequestRow {
  id: string;
  number: number;
  title: string;
  branch_name: string;
  head_sha: string;
  status: PullRequestViewModel['status'];
  html_url: string;
  author_login: string;
  linked_at: Date | string;
}

interface VerificationRunRow {
  id: string;
  source_state: VerificationViewModel['sourceState'];
  status: VerificationViewModel['status'];
  summary: string;
  criteria: string[] | string;
  files_touched: string[] | string;
  files_inspected: string[] | string;
  verified_sha: string | null;
  current_sha: string | null;
  blocking_findings_count: number;
  blocking_findings: string[] | string;
  risk_summary: string;
  failure_reason: string | null;
  verified_at: Date | string | null;
}

interface BountyRow {
  id: string;
  status: BountyViewModel['status'];
  amount_cents: number;
  currency: BountyViewModel['currency'];
  rationale: string;
  maintainer_accepted: boolean;
}

interface PaymentArtifactRow {
  id: string;
  source_state: PaymentArtifactViewModel['sourceState'];
  status: PaymentArtifactViewModel['status'];
  task_id: string | null;
  task_url: string | null;
  claim_id: string | null;
  claimer_kind: PaymentArtifactViewModel['claimerKind'];
  funding_mode: PaymentArtifactViewModel['fundingMode'];
  amount_cents: number;
  currency: PaymentArtifactViewModel['currency'];
  artifact_url: string | null;
  release_reason: string;
}

export async function getWorkflowArtifacts(client: PgClient, repositoryId: string, issueNumber: number): Promise<WorkflowArtifacts> {
  const [pullRequest, verification, bounty, paymentArtifact] = await Promise.all([
    getPullRequest(client, repositoryId, issueNumber),
    getLatestVerification(client, repositoryId, issueNumber),
    getBounty(client, repositoryId, issueNumber),
    getPaymentArtifact(client, repositoryId, issueNumber),
  ]);
  return { pullRequest, verification, bounty, paymentArtifact };
}

export async function persistPullRequest(client: PgClient, input: {
  repositoryId: string;
  issueNumber: number;
  number: number;
  title: string;
  branchName: string;
  headSha: string;
  status: PullRequestViewModel['status'];
  htmlUrl: string;
  authorLogin: string;
  linkedAt?: string;
}) {
  const id = pullRequestId(input.repositoryId, input.issueNumber, input.number);
  const linkedAt = input.linkedAt ?? new Date().toISOString();
  await client.query(
    `insert into maintaineros_pull_requests
      (id, repository_id, issue_number, provider, number, title, branch_name, head_sha, status, html_url, author_login, linked_at, updated_at)
     values ($1, $2, $3, 'github', $4, $5, $6, $7, $8, $9, $10, $11, now())
     on conflict (repository_id, issue_number) do update set
      number = excluded.number,
      title = excluded.title,
      branch_name = excluded.branch_name,
      head_sha = excluded.head_sha,
      status = excluded.status,
      html_url = excluded.html_url,
      author_login = excluded.author_login,
      linked_at = excluded.linked_at,
      updated_at = now()
     returning id`,
    [
      id,
      input.repositoryId,
      input.issueNumber,
      input.number,
      input.title,
      input.branchName,
      input.headSha,
      input.status,
      input.htmlUrl,
      input.authorLogin,
      linkedAt,
    ],
  );
  return { id, linkedAt, viewModel: await getPullRequest(client, input.repositoryId, input.issueNumber) };
}

export async function persistVerification(client: PgClient, input: {
  repositoryId: string;
  issueNumber: number;
  pullRequestId?: string | null;
  verification: VerificationViewModel;
  artifactUrl?: string | null;
  logUrl?: string | null;
  rawResponse?: Record<string, unknown> | null;
}) {
  const id = `greptile-${input.repositoryId}-${input.issueNumber}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const persistedPullRequestId = input.pullRequestId ?? await getPullRequestRecordId(client, input.repositoryId, input.issueNumber);
  if (!persistedPullRequestId) throw new Error('A persisted pull request is required before verification can be stored.');
  await client.query(
    `insert into maintaineros_verification_runs
      (id, repository_id, issue_number, pull_request_id, provider, source_state, status, summary, criteria, files_touched, files_inspected, verified_sha, current_sha, blocking_findings_count, blocking_findings, risk_summary, failure_reason, artifact_url, log_url, verified_at, raw_response)
     values ($1, $2, $3, $4, 'greptile', $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14::jsonb, $15, $16, $17, $18, $19, $20::jsonb)`,
    [
      id,
      input.repositoryId,
      input.issueNumber,
      persistedPullRequestId,
      input.verification.sourceState ?? 'live',
      input.verification.status,
      input.verification.summary,
      JSON.stringify(input.verification.criteria),
      JSON.stringify(input.verification.filesTouched),
      JSON.stringify(input.verification.filesInspected ?? []),
      input.verification.verifiedSha,
      input.verification.currentSha,
      input.verification.blockingFindingsCount,
      JSON.stringify(input.verification.blockingFindings ?? []),
      input.verification.riskSummary,
      input.verification.failureReason ?? null,
      input.artifactUrl ?? null,
      input.logUrl ?? null,
      input.verification.verifiedAt,
      JSON.stringify(input.rawResponse ?? {}),
    ],
  );
  return { id, viewModel: await getLatestVerification(client, input.repositoryId, input.issueNumber) };
}

export async function getPullRequestRecordId(client: PgClient, repositoryId: string, issueNumber: number) {
  const result = await client.query<{ id: string }>(
    `select id from maintaineros_pull_requests
     where repository_id = $1 and issue_number = $2
     limit 1`,
    [repositoryId, issueNumber],
  );
  return result.rows[0]?.id ?? null;
}

export async function ensureBounty(client: PgClient, input: {
  repositoryId: string;
  issueNumber: number;
  amountCents: number;
  rationale: string;
  status?: BountyViewModel['status'];
  maintainerAccepted?: boolean;
}) {
  const id = bountyId(input.repositoryId, input.issueNumber);
  await client.query(
    `insert into maintaineros_bounties
      (id, repository_id, issue_number, status, amount_cents, currency, rationale, maintainer_accepted, updated_at)
     values ($1, $2, $3, $4, $5, 'USD', $6, $7, now())
     on conflict (repository_id, issue_number) do update set
      amount_cents = excluded.amount_cents,
      rationale = excluded.rationale,
      updated_at = now()
     returning id`,
    [
      id,
      input.repositoryId,
      input.issueNumber,
      input.status ?? 'proposed',
      input.amountCents,
      input.rationale,
      input.maintainerAccepted ?? false,
    ],
  );
  return { id, viewModel: await getBounty(client, input.repositoryId, input.issueNumber) };
}

export async function updateBountyStatus(client: PgClient, repositoryId: string, issueNumber: number, status: BountyViewModel['status'], maintainerAccepted?: boolean) {
  await client.query(
    `update maintaineros_bounties
     set status = $3,
         maintainer_accepted = coalesce($4, maintainer_accepted),
         updated_at = now()
     where repository_id = $1 and issue_number = $2`,
    [repositoryId, issueNumber, status, maintainerAccepted ?? null],
  );
  return getBounty(client, repositoryId, issueNumber);
}

export async function persistPaymentArtifact(client: PgClient, input: {
  repositoryId: string;
  issueNumber: number;
  bountyId: string;
  artifact: PaymentArtifactViewModel;
  rawResponse?: Record<string, unknown> | null;
}) {
  const id = paymentArtifactId(input.repositoryId, input.issueNumber);
  await client.query(
    `insert into maintaineros_payment_artifacts
      (id, repository_id, issue_number, bounty_id, provider, source_state, status, task_id, task_url, claim_id, claimer_kind, funding_mode, amount_cents, currency, artifact_url, release_reason, raw_response, updated_at)
     values ($1, $2, $3, $4, 'clustly', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, now())
     on conflict (repository_id, issue_number) do update set
      status = excluded.status,
      task_id = excluded.task_id,
      task_url = excluded.task_url,
      claim_id = excluded.claim_id,
      claimer_kind = excluded.claimer_kind,
      funding_mode = excluded.funding_mode,
      amount_cents = excluded.amount_cents,
      currency = excluded.currency,
      artifact_url = excluded.artifact_url,
      release_reason = excluded.release_reason,
      raw_response = excluded.raw_response,
      updated_at = now()`,
    [
      id,
      input.repositoryId,
      input.issueNumber,
      input.bountyId,
      input.artifact.sourceState ?? 'live',
      input.artifact.status,
      input.artifact.taskId ?? null,
      input.artifact.taskUrl ?? null,
      input.artifact.claimId ?? null,
      input.artifact.claimerKind ?? null,
      input.artifact.fundingMode ?? null,
      input.artifact.amountCents,
      input.artifact.currency,
      input.artifact.artifactUrl ?? null,
      input.artifact.releaseReason,
      JSON.stringify(input.rawResponse ?? {}),
    ],
  );
  return { id, viewModel: await getPaymentArtifact(client, input.repositoryId, input.issueNumber) };
}

export function pullRequestId(repositoryId: string, issueNumber: number, pullRequestNumber: number) {
  return `github-${repositoryId}-${issueNumber}-${pullRequestNumber}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function bountyId(repositoryId: string, issueNumber: number) {
  return `clustly-bounty-${repositoryId}-${issueNumber}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function paymentArtifactId(repositoryId: string, issueNumber: number) {
  return `clustly-payment-${repositoryId}-${issueNumber}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function getPullRequest(client: PgClient, repositoryId: string, issueNumber: number) {
  const result = await client.query<PullRequestRow>(
    `select * from maintaineros_pull_requests
     where repository_id = $1 and issue_number = $2
     order by linked_at desc
     limit 1`,
    [repositoryId, issueNumber],
  );
  return result.rows[0] ? toPullRequest(result.rows[0]) : null;
}

async function getLatestVerification(client: PgClient, repositoryId: string, issueNumber: number) {
  const result = await client.query<VerificationRunRow>(
    `select * from maintaineros_verification_runs
     where repository_id = $1 and issue_number = $2
     order by created_at desc
     limit 1`,
    [repositoryId, issueNumber],
  );
  return result.rows[0] ? toVerification(result.rows[0]) : null;
}

async function getBounty(client: PgClient, repositoryId: string, issueNumber: number) {
  const result = await client.query<BountyRow>(
    `select * from maintaineros_bounties
     where repository_id = $1 and issue_number = $2
     limit 1`,
    [repositoryId, issueNumber],
  );
  return result.rows[0] ? toBounty(result.rows[0]) : null;
}

async function getPaymentArtifact(client: PgClient, repositoryId: string, issueNumber: number) {
  const result = await client.query<PaymentArtifactRow>(
    `select * from maintaineros_payment_artifacts
     where repository_id = $1 and issue_number = $2
     limit 1`,
    [repositoryId, issueNumber],
  );
  return result.rows[0] ? toPaymentArtifact(result.rows[0]) : null;
}

function toPullRequest(row: PullRequestRow): PullRequestViewModel {
  return {
    provider: 'github',
    number: row.number,
    title: row.title,
    branchName: row.branch_name,
    headSha: row.head_sha,
    status: row.status,
    htmlUrl: row.html_url,
    authorLogin: row.author_login,
    linkedAt: toIso(row.linked_at),
  };
}

function toVerification(row: VerificationRunRow): VerificationViewModel {
  const verification: VerificationViewModel = {
    provider: 'greptile',
    sourceState: row.source_state ?? 'live',
    status: row.status,
    summary: row.summary,
    criteria: stringArray(row.criteria),
    filesTouched: stringArray(row.files_touched),
    filesInspected: stringArray(row.files_inspected),
    verifiedSha: row.verified_sha,
    currentSha: row.current_sha,
    blockingFindingsCount: row.blocking_findings_count,
    blockingFindings: stringArray(row.blocking_findings),
    riskSummary: row.risk_summary,
    failureReason: row.failure_reason,
    verifiedAt: row.verified_at ? toIso(row.verified_at) : null,
    isStale: false,
  };
  const stale = isVerificationStale(verification);
  return {
    ...verification,
    status: stale ? 'stale' : verification.status,
    isStale: stale,
  };
}

function toBounty(row: BountyRow): BountyViewModel {
  return {
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    rationale: row.rationale,
    maintainerAccepted: row.maintainer_accepted,
  };
}

function toPaymentArtifact(row: PaymentArtifactRow): PaymentArtifactViewModel {
  return {
    provider: 'clustly',
    sourceState: row.source_state ?? 'live',
    status: row.status,
    taskId: row.task_id ?? undefined,
    taskUrl: row.task_url ?? undefined,
    claimId: row.claim_id ?? undefined,
    claimerKind: row.claimer_kind ?? null,
    fundingMode: row.funding_mode ?? 'api',
    amountCents: row.amount_cents,
    currency: row.currency,
    artifactUrl: row.artifact_url ?? undefined,
    releaseReason: row.release_reason,
  };
}

function stringArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
