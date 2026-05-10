import Link from 'next/link';
import { EvidenceBadge } from '@/components/maintaineros/evidence-badge';
import { PhaseShell } from '@/components/maintaineros/phase-shell';
import {
  canDisplayLiftClaim,
  computeBaselineEnrichedComparison,
  type ModeEvalMetrics,
} from '@/lib/maintaineros/eval-comparison';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';
import type { EvaluationSummaryViewModel } from '@/lib/maintaineros/types';

interface Props {
  params: Promise<{ org: string; repo: string }>;
}

export default async function EvalsPage({ params }: Props) {
  const { org, repo } = await params;
  const repository = getMaintainerOSRepository();
  const [evaluation, dashboard] = await Promise.all([
    repository.getEvaluationSummary(`${org}/${repo}`),
    repository.getDashboard(`${org}/${repo}`),
  ]);
  const rows = evaluation.rows ?? [];
  const comparison = computeBaselineEnrichedComparison(rows);
  const liftLabel =
    !canDisplayLiftClaim(evaluation) || evaluation.liftDeltaPct == null
      ? 'not claimed'
      : `${evaluation.liftDeltaPct >= 0 ? '+' : ''}${evaluation.liftDeltaPct} pts`;

  return (
    <PhaseShell
      eyebrow={`${org}/${repo} · evals`}
      title="Evals"
      description="Baseline versus Nia-enriched completion, verification pass rate, retries, escalation, and cost per verified fix."
      repository={dashboard.repository}
      providerStatuses={dashboard.providerStatuses}
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Sample" value={String(evaluation.sampleSize)} sub={evaluation.sampleLabel ?? `${evaluation.sourceState ?? 'planned'} sample`} />
        <Metric label="Baseline pass" value={formatRate(evaluation.baselinePassRate)} sub={formatCount(evaluation.baselinePassedCount, evaluation.baselineTotalCount)} />
        <Metric label="Nia enriched" value={formatRate(evaluation.enrichedContextPassRate)} sub={`${formatCount(evaluation.enrichedPassedCount, evaluation.enrichedTotalCount)} · ${liftLabel}`} />
        <Metric label="Cost / verified" value={`${evaluation.costPerVerifiedFixCents}c`} sub={costSummary(evaluation)} />
      </div>

      <div className="rounded-xl border border-white/8 bg-[#080d14] p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Baseline vs Nia-enriched (evidence rows)</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
              Pass rate, retry share, escalation share, cost per verified fix, and failure labels are computed per mode from the evidence rows below.
              Headline sample metrics above may aggregate a wider issue set than this table.
            </p>
          </div>
          <EvidenceBadge sourceState={evaluation.sourceState ?? 'planned'} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                <th className="py-2 pr-3 font-medium">Metric</th>
                <th className="py-2 pr-3 font-medium">Baseline</th>
                <th className="py-2 font-medium">Nia-enriched</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <ComparisonRow label="Evidence rows" baseline={String(comparison.baseline.rowCount)} enriched={String(comparison.niaEnriched.rowCount)} />
              <ComparisonRow
                label="Pass rate (terminal outcomes)"
                baseline={formatMaybePassRate(comparison.baseline)}
                enriched={formatMaybePassRate(comparison.niaEnriched)}
              />
              <ComparisonRow
                label="Retry rate"
                baseline={formatMaybeShare(comparison.baseline.retryRate, comparison.baseline.rowCount)}
                enriched={formatMaybeShare(comparison.niaEnriched.retryRate, comparison.niaEnriched.rowCount)}
              />
              <ComparisonRow
                label="Escalation rate"
                baseline={formatMaybeShare(comparison.baseline.escalationRate, comparison.baseline.rowCount)}
                enriched={formatMaybeShare(comparison.niaEnriched.escalationRate, comparison.niaEnriched.rowCount)}
              />
              <ComparisonRow
                label="Cost / verified fix"
                baseline={formatMaybeCost(comparison.baseline.costPerVerifiedFixCents, comparison.baseline.passedCount)}
                enriched={formatMaybeCost(comparison.niaEnriched.costPerVerifiedFixCents, comparison.niaEnriched.passedCount)}
              />
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FailureMix title="Baseline verification failures" metrics={comparison.baseline} />
          <FailureMix title="Nia-enriched verification failures" metrics={comparison.niaEnriched} />
        </div>
      </div>

      <div className="rounded-xl border border-white/8 bg-[#080d14] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Methodology</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
              Eval rows compare baseline agent attempts against Nia-enriched attempts and treat Greptile verification as the pass/fail gate.
              {evaluation.comparisonKind === 'paired' ? ' Rows are paired.' : ' Rows are fixture-backed/comparable unless marked unpaired, so lift stays source-labeled.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EvidenceBadge sourceState={evaluation.sourceState ?? 'planned'} />
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase text-zinc-500">{evaluation.comparisonKind ?? 'planned'}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Retry rate" value={formatRate(evaluation.retryRate)} />
          <Metric label="Escalation rate" value={formatRate(evaluation.escalationRate)} />
          <Metric label="Cheap-first savings" value={evaluation.cheapFirstSavingsPct == null ? 'unknown' : `${evaluation.cheapFirstSavingsPct}%`} sub={evaluation.costEvidence ?? 'unknown'} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {evaluation.commonFailureReasons.map((reason) => (
            <span key={reason} className="rounded-full border border-white/8 bg-white/[0.02] px-2 py-1 text-xs text-zinc-500">{reason}</span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/8 bg-[#080d14] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Evidence Rows</h2>
          <EvidenceBadge sourceState={evaluation.sourceState ?? 'planned'} />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[900px] divide-y divide-white/6">
            <div className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_1fr_0.8fr] gap-3 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-700">
              <span>Attempt</span>
              <span>Mode</span>
              <span>Verification</span>
              <span>Retry</span>
              <span>Cost</span>
              <span>Failure</span>
              <span className="text-right">Proof</span>
            </div>
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_1fr_0.8fr] items-center gap-3 px-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-zinc-200">{row.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-zinc-600">{row.issueNumber ? `#${row.issueNumber}` : row.sampleId ?? row.id} · {row.pairState ?? 'unpaired'}</p>
                    {row.sourceState && <EvidenceBadge sourceState={row.sourceState} />}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">{row.contextMode}</p>
                  {row.contextPackId && <p className="mt-1 truncate text-[10px] text-zinc-600">{row.contextPackId}</p>}
                </div>
                <span className="w-fit rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase text-zinc-500">{row.verificationStatus}</span>
                <div className="text-xs text-zinc-500">
                  <p>{row.retryCount ?? 0} retries</p>
                  <p>{row.escalated ? 'escalated' : 'not escalated'}</p>
                </div>
                <div className="text-xs text-zinc-500">
                  <p>{formatCost(row.modelCostCents)}</p>
                  <p>{row.modelTierPath ?? 'unknown'}</p>
                </div>
                <p className="text-xs text-zinc-500">{row.failureCategory ?? 'none'}</p>
                <div className="flex justify-end gap-3 text-xs">
                  <Link className="text-zinc-400 hover:text-white" href={resolveEvidenceHref(row.traceUrl, org, repo, row)}>
                    Trace
                  </Link>
                  {row.contextPackId && (
                    <Link className="text-zinc-400 hover:text-white" href={resolveEvidenceHref(row.traceUrl, org, repo, row)}>
                      Context
                    </Link>
                  )}
                  <Link className="text-zinc-400 hover:text-white" href={resolveVerificationHref(row.verificationUrl, org, repo, row)}>
                    Verify
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 && (
            <div className="rounded-lg border border-white/6 p-4">
              <p className="text-sm font-medium text-white">No eval rows yet</p>
              <p className="mt-2 text-sm text-zinc-500">Live imports are available, but eval rows appear after verification artifacts are recorded for baseline or Nia-enriched attempts.</p>
            </div>
          )}
        </div>
      </div>
      <Link className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400" href={`/${org}/${repo}/proof`}>
        View proof package
      </Link>
    </PhaseShell>
  );
}

function ComparisonRow({
  label,
  baseline,
  enriched,
}: {
  label: string;
  baseline: string;
  enriched: string;
}) {
  return (
    <tr className="border-b border-white/6">
      <td className="py-2.5 pr-3 text-zinc-400">{label}</td>
      <td className="py-2.5 pr-3 tabular-nums">{baseline}</td>
      <td className="py-2.5 tabular-nums">{enriched}</td>
    </tr>
  );
}

function FailureMix({ title, metrics }: { title: string; metrics: ModeEvalMetrics }) {
  const items = metrics.failureCategories.slice(0, 5);
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">No labeled failures in this slice.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map(({ category, count }) => (
            <span
              key={category}
              className="rounded-full border border-white/8 bg-white/[0.02] px-2 py-1 text-xs text-zinc-500"
            >
              {category} ({count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatMaybePassRate(m: ModeEvalMetrics): string {
  if (m.terminalCount === 0) return '— (no terminal outcomes)';
  if (m.passRate == null) return '—';
  return `${formatRate(m.passRate)} · ${m.passedCount}/${m.terminalCount}`;
}

function formatMaybeShare(rate: number | null, rowCount: number): string {
  if (rowCount === 0) return '—';
  if (rate == null) return '—';
  return formatRate(rate);
}

function formatMaybeCost(cost: number | null, verifiedCount: number): string {
  if (verifiedCount === 0) return '— (no verified rows)';
  if (cost == null) return 'unknown';
  return `${cost}c`;
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#080d14] p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function formatRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatCount(passed?: number, total?: number) {
  if (passed == null || total == null || total === 0) return 'no counted rows';
  return `${passed}/${total} passed`;
}

function formatCost(value?: number | null) {
  return value == null ? 'unknown' : `${value}c`;
}

type EvaluationRow = NonNullable<EvaluationSummaryViewModel['rows']>[number];

function costSummary(evaluation: EvaluationSummaryViewModel) {
  if (evaluation.costEvidence === 'unknown') return 'cost evidence unknown';
  const premium = evaluation.premiumOnlyCostPerVerifiedFixCents == null ? 'premium unknown' : `${evaluation.premiumOnlyCostPerVerifiedFixCents}c premium-only`;
  return `${evaluation.costEvidence ?? 'planned'} · ${premium}`;
}

function resolveEvidenceHref(
  href: string | undefined,
  org: string,
  repo: string,
  row: EvaluationRow,
) {
  if (!href && row.issueNumber) return `/${org}/${repo}/issues/${row.issueNumber}/trace`;
  if (!href) return `/${org}/${repo}/evals`;
  return href.replace('/maintaineros-demo-large/', `/${org}/${repo}/`);
}

function resolveVerificationHref(
  href: string | undefined,
  org: string,
  repo: string,
  row: EvaluationRow,
) {
  if (!href && row.issueNumber) return `/${org}/${repo}/issues/${row.issueNumber}/trace`;
  if (!href) return `/${org}/${repo}/verification`;
  return href.replace('/maintaineros-demo-large/', `/${org}/${repo}/`);
}
