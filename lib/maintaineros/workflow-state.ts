import type {
  BountyViewModel,
  PaymentArtifactViewModel,
  PullRequestViewModel,
  VerificationViewModel,
} from './types';
import type { PgClient } from './postgres';

export interface WorkflowArtifacts {
  pullRequest: PullRequestViewModel | null;
  verification: VerificationViewModel | null;
  bounty: BountyViewModel | null;
  paymentArtifact: PaymentArtifactViewModel | null;
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
  const [bounty, paymentArtifact] = await Promise.all([
    getBounty(client, repositoryId, issueNumber),
    getPaymentArtifact(client, repositoryId, issueNumber),
  ]);
  return { pullRequest: null, verification: null, bounty, paymentArtifact };
}

export async function persistPullRequest(client: PgClient, input: {
  repositoryId: string;
  issueNumber: number;
  number: number;
  title: string;
  baseBranch?: string | null;
  branchName: string;
  headSha: string;
  status: PullRequestViewModel['status'];
  htmlUrl: string;
  authorLogin: string;
  authorOwnerType?: PullRequestViewModel['authorOwnerType'];
  automationOwned?: boolean;
  linkedAt?: string;
}) {
  const id = pullRequestId(input.repositoryId, input.issueNumber, input.number);
  const linkedAt = input.linkedAt ?? new Date().toISOString();
  await client.query(
    `insert into maintaineros_pull_requests
      (id, repository_id, issue_number, provider, number, title, base_branch, branch_name, head_sha, status, html_url, author_login, author_owner_type, automation_owned, linked_at, source_state, updated_at)
     values ($1, $2, $3, 'github', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'live', now())
     on conflict (repository_id, number) do update set
      issue_number = excluded.issue_number,
      number = excluded.number,
      title = excluded.title,
      base_branch = excluded.base_branch,
      branch_name = excluded.branch_name,
      head_sha = excluded.head_sha,
      status = excluded.status,
      html_url = excluded.html_url,
      author_login = excluded.author_login,
      author_owner_type = excluded.author_owner_type,
      automation_owned = excluded.automation_owned,
      linked_at = excluded.linked_at,
      updated_at = now()
     returning id`,
    [
      id,
      input.repositoryId,
      input.issueNumber,
      input.number,
      input.title,
      input.baseBranch ?? null,
      input.branchName,
      input.headSha,
      input.status,
      input.htmlUrl,
      input.authorLogin,
      input.authorOwnerType ?? 'unknown',
      input.automationOwned ?? false,
      linkedAt,
    ],
  );
  return {
    id,
    linkedAt,
    viewModel: {
      provider: 'github' as const,
      id,
      sourceState: 'live' as const,
      number: input.number,
      title: input.title,
      baseBranch: input.baseBranch ?? null,
      branchName: input.branchName,
      headSha: input.headSha,
      status: input.status,
      htmlUrl: input.htmlUrl,
      authorLogin: input.authorLogin,
      authorOwnerType: input.authorOwnerType ?? 'unknown',
      automationOwned: input.automationOwned ?? false,
      linkedAt,
    },
  };
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
      (id, pull_request_id, provider, source_state, status, summary, criteria, files_touched, files_inspected, verified_sha, current_sha, blocking_findings, risk_summary, failure_reason, artifact_url, verified_at, updated_at)
     values ($1, $2, 'greptile', $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11::jsonb, $12, $13, $14, $15, now())`,
    [
      id,
      persistedPullRequestId,
      input.verification.sourceState ?? 'live',
      input.verification.status,
      input.verification.summary,
      JSON.stringify(input.verification.criteria),
      JSON.stringify(input.verification.filesTouched),
      JSON.stringify(input.verification.filesInspected ?? []),
      input.verification.verifiedSha,
      input.verification.currentSha,
      JSON.stringify(input.verification.blockingFindings ?? []),
      input.verification.riskSummary,
      input.verification.failureReason ?? null,
      input.artifactUrl ?? null,
      input.verification.verifiedAt,
    ],
  );
  void input.logUrl;
  void input.rawResponse;
  return { id, viewModel: input.verification };
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
         maintainer_accepted = coalesce($4::boolean, maintainer_accepted),
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
