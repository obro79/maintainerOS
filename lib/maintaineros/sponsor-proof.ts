import type { ArtifactSourceState, ArtifactStatus, IssueDetailViewModel, ProviderKey, SponsorProofViewModel } from './types';
import type { ProviderRunStatus } from './provider-runtime';

export const SPONSOR_PROOF_PROVIDERS: ProviderKey[] = ['github', 'neon', 'clod', 'nia', 'daytona', 'greptile', 'clustly'];

const PROOF_COPY: Record<ProviderKey, { title: string; plannedSummary: string }> = {
  github: {
    title: 'GitHub issue and PR evidence',
    plannedSummary: 'GitHub proof records imported issue metadata, linked pull requests, and source URLs.',
  },
  neon: {
    title: 'Neon durable data spine',
    plannedSummary: 'Neon proof records persisted repository, issue, provider-run, and trace evidence.',
  },
  clod: {
    title: 'CLōD product-path call',
    plannedSummary: 'CLōD proof records model, tier, cost, latency, and work-order output.',
  },
  nia: {
    title: 'Nia context pack',
    plannedSummary: 'Nia proof records source IDs, snippets, citations, and suggested commands.',
  },
  daytona: {
    title: 'Daytona-style sandbox',
    plannedSummary: 'Daytona proof records sandbox metadata, commands, logs, files touched, and PR artifacts.',
  },
  greptile: {
    title: 'Greptile verification',
    plannedSummary: 'Greptile proof records pass/fail/stale verification bundles.',
  },
  clustly: {
    title: 'Clustly task rail',
    plannedSummary: 'Clustly proof records task lifecycle and release gate evidence.',
  },
};

export function buildPlannedSponsorProof(): SponsorProofViewModel[] {
  return SPONSOR_PROOF_PROVIDERS.map((provider) => ({
    provider,
    sourceState: 'planned',
    title: PROOF_COPY[provider].title,
    status: 'pending',
    summary: PROOF_COPY[provider].plannedSummary,
  }));
}

export function mergeSponsorProof(proof: SponsorProofViewModel[] | null | undefined): SponsorProofViewModel[] {
  const byProvider = new Map((proof ?? []).map((item) => [item.provider, item]));
  return buildPlannedSponsorProof().map((planned) => byProvider.get(planned.provider) ?? planned);
}

export function buildSponsorProofFromProviderRun(input: {
  id: string;
  provider: ProviderKey;
  purpose: string;
  status: ProviderRunStatus;
  sourceState: ArtifactSourceState;
  runId?: string | null;
  artifactUrl?: string | null;
  logUrl?: string | null;
  screenshotUrl?: string | null;
  errorMessage?: string | null;
  responseMeta?: Record<string, unknown> | null;
  occurredAt: string;
}): SponsorProofViewModel {
  const detail = typeof input.responseMeta?.detail === 'string' ? input.responseMeta.detail : null;
  const runLabel = input.runId ?? input.id;
  return {
    provider: input.provider,
    sourceState: input.sourceState,
    title: PROOF_COPY[input.provider].title,
    status: providerRunStatusToArtifactStatus(input.status),
    runId: runLabel,
    artifactUrl: input.artifactUrl ?? undefined,
    logUrl: input.logUrl ?? undefined,
    screenshotUrl: input.screenshotUrl ?? undefined,
    occurredAt: input.occurredAt,
    summary: input.errorMessage ?? detail ?? `${input.provider} ${input.purpose} proof run recorded ${input.status}.`,
  };
}

export function buildSponsorProofFromIssue(issue: IssueDetailViewModel, sourceState: ArtifactSourceState): SponsorProofViewModel[] {
  return mergeSponsorProof([
    {
      provider: 'github',
      sourceState,
      title: PROOF_COPY.github.title,
      status: issue.pullRequest ? 'succeeded' : 'pending',
      runId: issue.pullRequest ? `pr-${issue.pullRequest.number}` : undefined,
      artifactUrl: issue.pullRequest?.htmlUrl ?? issue.htmlUrl,
      occurredAt: issue.pullRequest?.linkedAt,
      summary: issue.pullRequest
        ? `PR #${issue.pullRequest.number} is linked to issue #${issue.number}.`
        : `Issue #${issue.number} is available as GitHub source evidence.`,
    },
    {
      provider: 'neon',
      sourceState,
      title: PROOF_COPY.neon.title,
      status: 'succeeded',
      runId: `${issue.id}-fixture-record`,
      summary: 'Fixture repository data is available through the MaintainerOS repository interface.',
    },
    {
      provider: 'clod',
      sourceState: issue.modelRun.sourceState ?? sourceState,
      title: PROOF_COPY.clod.title,
      status: issue.modelRun.status === 'succeeded' ? 'succeeded' : 'failed',
      runId: issue.modelRun.runId ?? issue.modelRun.id,
      occurredAt: issue.modelRun.createdAt,
      summary: `${issue.modelRun.model} selected ${issue.modelRun.tier}; cost ${formatCost(issue.modelRun.estimatedCostCents)}, premium baseline ${formatCost(issue.modelRun.premiumBaselineCents)}.`,
    },
    {
      provider: 'nia',
      sourceState: issue.contextPack?.sourceState ?? 'planned',
      title: PROOF_COPY.nia.title,
      status: issue.contextPack?.status ?? 'pending',
      runId: issue.contextPack?.id,
      occurredAt: issue.contextPack?.createdAt,
      summary: issue.contextPack?.summary ?? PROOF_COPY.nia.plannedSummary,
    },
    {
      provider: 'daytona',
      sourceState: issue.sandboxExecutions[0]?.sourceState ?? 'planned',
      title: PROOF_COPY.daytona.title,
      status: issue.sandboxExecutions[0]?.status ?? 'pending',
      runId: issue.sandboxExecutions[0]?.sandboxId,
      artifactUrl: issue.sandboxExecutions[0]?.pullRequestUrl ?? undefined,
      summary: issue.sandboxExecutions[0]?.logSummary ?? PROOF_COPY.daytona.plannedSummary,
    },
    {
      provider: 'greptile',
      sourceState: issue.verification?.sourceState ?? 'planned',
      title: PROOF_COPY.greptile.title,
      status: issue.verification?.status ?? 'pending',
      runId: issue.verification?.verifiedSha ?? issue.verification?.currentSha ?? undefined,
      occurredAt: issue.verification?.verifiedAt ?? undefined,
      summary: issue.verification?.summary ?? PROOF_COPY.greptile.plannedSummary,
    },
    {
      provider: 'clustly',
      sourceState: issue.paymentArtifact?.sourceState ?? 'planned',
      title: PROOF_COPY.clustly.title,
      status: clustlyStatusToProofStatus(issue.paymentArtifact?.status),
      runId: issue.paymentArtifact?.taskId,
      artifactUrl: issue.paymentArtifact?.taskUrl ?? issue.paymentArtifact?.artifactUrl,
      summary: issue.paymentArtifact?.releaseReason ?? PROOF_COPY.clustly.plannedSummary,
    },
  ]);
}

function providerRunStatusToArtifactStatus(status: ProviderRunStatus): ArtifactStatus {
  if (status === 'offline-skipped') return 'pending';
  return status;
}

function formatCost(value: number | null) {
  return value == null ? 'unknown' : `${value}c`;
}

function clustlyStatusToProofStatus(status: NonNullable<IssueDetailViewModel['paymentArtifact']>['status'] | undefined): ArtifactStatus {
  if (!status || status === 'draft') return 'pending';
  if (status === 'failed' || status === 'refunded') return 'failed';
  if (status === 'released' || status === 'paid' || status === 'approved') return 'succeeded';
  return 'running';
}
