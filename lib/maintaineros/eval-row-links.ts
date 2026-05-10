import type { EvaluationSummaryViewModel } from '@/lib/maintaineros/types';

export type EvalRow = NonNullable<EvaluationSummaryViewModel['rows']>[number];

const DEMO_SEGMENT = '/maintaineros-demo-large/';

/** Rewrites legacy demo fixture paths to the current org/repo URL; preserves query + hash. */
export function rewriteEvalUrl(href: string | undefined, org: string, repo: string): string | undefined {
  if (!href) return undefined;
  if (href.includes(DEMO_SEGMENT)) {
    return href.replace(DEMO_SEGMENT, `/${org}/${repo}/`);
  }
  return href;
}

/** Full URL to the trace ledger (includes hash when the row provides a traceUrl fragment). */
export function evalTraceHref(org: string, repo: string, row: EvalRow): string {
  const fromRow = rewriteEvalUrl(row.traceUrl, org, repo);
  if (fromRow) return fromRow;
  if (row.issueNumber != null) {
    const base = `/${org}/${repo}/issues/${row.issueNumber}/trace`;
    if (row.attemptId) return `${base}#${encodeURIComponent(row.attemptId)}`;
    return base;
  }
  return `/${org}/${repo}/backlog`;
}

/** URL to verification evidence: stored link, or trace / issue verification section. */
export function evalVerificationHref(org: string, repo: string, row: EvalRow): string {
  const fromRow = rewriteEvalUrl(row.verificationUrl, org, repo);
  if (fromRow) return fromRow;
  if (row.issueNumber != null) {
    return `/${org}/${repo}/issues/${row.issueNumber}#greptile-verification`;
  }
  return `/${org}/${repo}/verification`;
}

export function evalIssueDetailHref(org: string, repo: string, row: EvalRow): string {
  if (row.issueNumber != null) return `/${org}/${repo}/issues/${row.issueNumber}`;
  return `/${org}/${repo}/backlog`;
}

/** Nia context pack on issue detail; null when the row is not Nia-enriched with a pack. */
export function evalContextPackHref(org: string, repo: string, row: EvalRow): string | null {
  if (!row.contextPackId) return null;
  if (row.issueNumber != null) return `/${org}/${repo}/issues/${row.issueNumber}#nia-context-pack`;
  return `/${org}/${repo}/backlog`;
}
