import type { ArtifactStatus, ContextMode, EvaluationSummaryViewModel } from '@/lib/maintaineros/types';

export type EvaluationRowLike = NonNullable<EvaluationSummaryViewModel['rows']>[number];

export interface ModeEvalMetrics {
  rowCount: number;
  terminalCount: number;
  passedCount: number;
  /** Pass rate among terminal verification outcomes; null if no terminal rows yet */
  passRate: number | null;
  /** Share of rows with at least one retry */
  retryRate: number | null;
  /** Share of rows marked escalated */
  escalationRate: number | null;
  /** Average model cost for verified (passed) rows with known cost */
  costPerVerifiedFixCents: number | null;
  /** Failure labels aggregated for non-pass terminal rows */
  failureCategories: Array<{ category: string; count: number }>;
}

function isTerminalVerification(status: ArtifactStatus): boolean {
  return status !== 'pending' && status !== 'running';
}

function isPassVerification(status: ArtifactStatus): boolean {
  return status === 'passed' || status === 'succeeded';
}

export function computeModeEvalMetrics(rows: EvaluationRowLike[], mode: ContextMode): ModeEvalMetrics {
  const m = rows.filter((r) => r.contextMode === mode);
  const rowCount = m.length;
  const terminalRows = m.filter((r) => isTerminalVerification(r.verificationStatus));
  const terminalCount = terminalRows.length;
  const passedCount = terminalRows.filter((r) => isPassVerification(r.verificationStatus)).length;
  const passRate = terminalCount > 0 ? passedCount / terminalCount : null;

  const retryRate =
    rowCount > 0 ? m.filter((r) => (r.retryCount ?? 0) > 0).length / rowCount : null;
  const escalationRate =
    rowCount > 0 ? m.filter((r) => Boolean(r.escalated)).length / rowCount : null;

  const verifiedCosts = m.filter(
    (r) => isPassVerification(r.verificationStatus) && r.modelCostCents != null,
  );
  const costPerVerifiedFixCents =
    verifiedCosts.length > 0
      ? Math.round(
          verifiedCosts.reduce((sum, r) => sum + (r.modelCostCents as number), 0) / verifiedCosts.length,
        )
      : null;

  const failBuckets = new Map<string, number>();
  for (const r of terminalRows) {
    if (isPassVerification(r.verificationStatus)) continue;
    const cat = r.failureCategory?.trim();
    if (!cat) continue;
    failBuckets.set(cat, (failBuckets.get(cat) ?? 0) + 1);
  }
  const failureCategories = [...failBuckets.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    rowCount,
    terminalCount,
    passedCount,
    passRate,
    retryRate,
    escalationRate,
    costPerVerifiedFixCents,
    failureCategories,
  };
}

export function computeBaselineEnrichedComparison(rows: EvaluationRowLike[]) {
  return {
    baseline: computeModeEvalMetrics(rows, 'baseline'),
    niaEnriched: computeModeEvalMetrics(rows, 'nia-enriched'),
  };
}

/** Numeric lift is shown only when the summary includes both a delta and an explicit source state. */
export function canDisplayLiftClaim(
  evaluation: Pick<EvaluationSummaryViewModel, 'liftDeltaPct' | 'sourceState'>,
): boolean {
  return evaluation.liftDeltaPct != null && evaluation.sourceState != null;
}
