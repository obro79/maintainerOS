import Link from 'next/link';
import { EvidenceBadge } from '@/components/maintaineros/evidence-badge';
import { PhaseShell } from '@/components/maintaineros/phase-shell';
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
  const liftLabel = evaluation.liftDeltaPct == null ? 'not claimed' : `+${evaluation.liftDeltaPct} pts`;

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

      <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Methodology</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#F9F7F7]/56">
              Eval rows compare baseline agent attempts against Nia-enriched attempts and treat Greptile verification as the pass/fail gate.
              {evaluation.comparisonKind === 'paired' ? ' Rows are paired.' : ' Rows are fixture-backed/comparable unless marked unpaired, so lift stays source-labeled.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EvidenceBadge sourceState={evaluation.sourceState ?? 'planned'} />
            <span className="rounded-full border border-[#F9F7F7]/12 px-2 py-0.5 text-[10px] uppercase text-[#F9F7F7]/56">{evaluation.comparisonKind ?? 'planned'}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Retry rate" value={formatRate(evaluation.retryRate)} />
          <Metric label="Escalation rate" value={formatRate(evaluation.escalationRate)} />
          <Metric label="Cheap-first savings" value={evaluation.cheapFirstSavingsPct == null ? 'unknown' : `${evaluation.cheapFirstSavingsPct}%`} sub={evaluation.costEvidence ?? 'unknown'} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {evaluation.commonFailureReasons.map((reason) => (
            <span key={reason} className="rounded-full border border-[#F9F7F7]/12 bg-[#F9F7F7]/[0.025] px-2 py-1 text-xs text-[#F9F7F7]/56">{reason}</span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Evidence Rows</h2>
          <EvidenceBadge sourceState={evaluation.sourceState ?? 'planned'} />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[900px] divide-y divide-[#F9F7F7]/10">
            <div className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_1fr_0.8fr] gap-3 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[#F9F7F7]/28">
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
                  <p className="truncate text-[#F9F7F7]/88">{row.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-[#F9F7F7]/40">{row.issueNumber ? `#${row.issueNumber}` : row.sampleId ?? row.id} · {row.pairState ?? 'unpaired'}</p>
                    {row.sourceState && <EvidenceBadge sourceState={row.sourceState} />}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#F9F7F7]/68">{row.contextMode}</p>
                  {row.contextPackId && <p className="mt-1 truncate text-[10px] text-[#F9F7F7]/40">{row.contextPackId}</p>}
                </div>
                <span className="w-fit rounded-full border border-[#F9F7F7]/12 px-2 py-0.5 text-[10px] uppercase text-[#F9F7F7]/56">{row.verificationStatus}</span>
                <div className="text-xs text-[#F9F7F7]/56">
                  <p>{row.retryCount ?? 0} retries</p>
                  <p>{row.escalated ? 'escalated' : 'not escalated'}</p>
                </div>
                <div className="text-xs text-[#F9F7F7]/56">
                  <p>{formatCost(row.modelCostCents)}</p>
                  <p>{row.modelTierPath ?? 'unknown'}</p>
                </div>
                <p className="text-xs text-[#F9F7F7]/56">{row.failureCategory ?? 'none'}</p>
                <div className="flex justify-end gap-3 text-xs">
                  <Link className="text-[#F9F7F7]/68 hover:text-white" href={resolveEvidenceHref(row.traceUrl, org, repo, row)}>
                    Trace
                  </Link>
                  {row.contextPackId && (
                    <Link className="text-[#F9F7F7]/68 hover:text-white" href={resolveEvidenceHref(row.traceUrl, org, repo, row)}>
                      Context
                    </Link>
                  )}
                  <Link className="text-[#F9F7F7]/68 hover:text-white" href={resolveVerificationHref(row.verificationUrl, org, repo, row)}>
                    Verify
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 && (
            <div className="rounded-lg border border-[#F9F7F7]/10 p-4">
              <p className="text-sm font-medium text-white">No eval rows yet</p>
              <p className="mt-2 text-sm text-[#F9F7F7]/56">Live imports are available, but eval rows appear after verification artifacts are recorded for baseline or Nia-enriched attempts.</p>
            </div>
          )}
        </div>
      </div>
      <Link className="rounded-lg border border-[#F9F7F7]/12 px-3 py-1.5 text-xs text-[#F9F7F7]/68" href={`/${org}/${repo}/proof`}>
        View proof package
      </Link>
    </PhaseShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/40">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#F9F7F7]/40">{sub}</p>}
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
