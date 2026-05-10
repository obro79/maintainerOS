import type { IssueDetailViewModel, ModelRunViewModel } from './types';

export function buildClodRunEvidenceMeta(input: {
  issue: Pick<IssueDetailViewModel, 'id' | 'number' | 'route'>;
  modelRun: ModelRunViewModel;
  routeConfidence?: number;
  routeComplexityScore?: number;
  routeRiskScore?: number;
}) {
  return {
    issueId: input.issue.id,
    issueNumber: input.issue.number,
    route: input.issue.route,
    purpose: input.modelRun.purpose,
    model: input.modelRun.model,
    tier: input.modelRun.tier,
    status: input.modelRun.status,
    selectionReason: input.modelRun.selectionReason,
    latencyMs: input.modelRun.latencyMs,
    inputTokens: input.modelRun.inputTokens,
    outputTokens: input.modelRun.outputTokens,
    estimatedCostCents: input.modelRun.estimatedCostCents,
    premiumBaselineCents: input.modelRun.premiumBaselineCents,
    fallbackReason: input.modelRun.fallbackReason ?? null,
    routeConfidence: input.routeConfidence ?? null,
    routeComplexityScore: input.routeComplexityScore ?? null,
    routeRiskScore: input.routeRiskScore ?? null,
  };
}
