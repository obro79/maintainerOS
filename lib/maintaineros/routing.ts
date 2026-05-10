import type { ExecutionRoute, IssueComplexity, IssueRisk, ModelRunViewModel } from './types';

interface RawIssueLike {
  title: string;
  body?: string;
  labels?: string[];
  commentsCount?: number;
  classification?: {
    route?: ExecutionRoute;
    complexityScore?: number;
    riskScore?: number;
    confidence?: number;
    rationale?: string;
  };
}

export interface RouteDecision {
  route: ExecutionRoute;
  complexityScore: number;
  riskScore: number;
  confidence: number;
  rationale: string;
}

export interface ModelSelection {
  tier: ModelRunViewModel['tier'];
  model: string;
  reason: string;
}

export function classifyComplexity(score: number | undefined): IssueComplexity {
  if (!score) return 'unknown';
  if (score <= 3) return 'low';
  if (score <= 6) return 'medium';
  return 'high';
}

export function classifyRisk(score: number | undefined): IssueRisk {
  if (!score || score <= 3) return 'low';
  if (score <= 6) return 'medium';
  return 'high';
}

export function scoreIssue(issue: RawIssueLike, priorFailures = 0): RouteDecision {
  const labels = new Set((issue.labels ?? []).map((label) => label.toLowerCase()));
  const existing = issue.classification;
  const complexityScore = clampScore((existing?.complexityScore ?? heuristicComplexity(issue)) + priorFailures);
  const riskScore = clampScore((existing?.riskScore ?? heuristicRisk(issue)) + Math.min(priorFailures, 2));
  const confidence = existing?.confidence ?? confidenceFor(issue, complexityScore, riskScore);
  let route: ExecutionRoute;

  if (labels.has('needs reproduction') || labels.has('triage')) {
    route = 'close-or-clarify';
  } else if (labels.has('bounty') || labels.has('integration')) {
    route = 'bounty-worthy';
  } else if (labels.has('security') || labels.has('needs design') || riskScore >= 7) {
    route = 'maintainer-review';
  } else {
    route = 'agent-solvable';
  }

  if (priorFailures >= 2 && route === 'agent-solvable') {
    route = complexityScore >= 6 ? 'bounty-worthy' : 'maintainer-review';
  }

  return {
    route,
    complexityScore,
    riskScore,
    confidence,
    rationale:
      existing?.rationale ??
      `${route} because complexity=${complexityScore}, risk=${riskScore}, confidence=${Math.round(confidence * 100)}%.`,
  };
}

export function selectClodModel(decision: RouteDecision, priorFailures = 0): ModelSelection {
  if (priorFailures >= 2 || decision.riskScore >= 8) {
    return {
      tier: 'deep',
      model: process.env.CLOD_DEEP_MODEL || 'DeepSeek V3',
      reason: 'High risk or repeated failure needs a deeper model before human/bounty escalation.',
    };
  }

  if (decision.complexityScore >= 6 || decision.confidence < 0.8) {
    return {
      tier: 'balanced',
      model: process.env.CLOD_BALANCED_MODEL || 'GPT 4o',
      reason: 'Moderate complexity or lower confidence needs a balanced model for routing rationale.',
    };
  }

  return {
    tier: 'cheap-open',
    model: process.env.CLOD_CHEAP_MODEL || 'DeepSeek V3',
    reason: 'Low-risk, high-confidence issue should use the cheapest capable CLōD model first.',
  };
}

export function estimatePremiumBaselineCents(modelRunCost: number | null, tier: ModelRunViewModel['tier']): number | null {
  if (modelRunCost == null) return null;
  if (tier === 'premium-fallback') return modelRunCost;
  return Math.max(modelRunCost + 1, Math.round(modelRunCost * 2.5));
}

function heuristicComplexity(issue: RawIssueLike) {
  const text = `${issue.title} ${issue.body ?? ''}`.toLowerCase();
  if (text.includes('architecture') || text.includes('adapter') || text.includes('migration')) return 7;
  if (text.includes('docs') || text.includes('typo')) return 2;
  return 4;
}

function heuristicRisk(issue: RawIssueLike) {
  const text = `${issue.title} ${issue.body ?? ''}`.toLowerCase();
  if (text.includes('security') || text.includes('permission') || text.includes('auth')) return 8;
  if (text.includes('migration') || text.includes('payment')) return 6;
  return 3;
}

function confidenceFor(issue: RawIssueLike, complexityScore: number, riskScore: number) {
  const labelBonus = Math.min((issue.labels?.length ?? 0) * 0.015, 0.06);
  const commentPenalty = Math.min((issue.commentsCount ?? 0) * 0.003, 0.08);
  return Number(Math.max(0.55, Math.min(0.98, 0.93 - complexityScore * 0.015 - riskScore * 0.01 + labelBonus - commentPenalty)).toFixed(2));
}

function clampScore(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
}
