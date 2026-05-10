import type { ExecutionRoute, IssueComplexity, IssueRisk, ModelRunViewModel, RoutePolicyViewModel } from './types';

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

export interface ModelSelectionOptions {
  priorFailures?: number;
  verificationStatus?: 'pending' | 'passed' | 'failed' | 'stale' | null;
  fallbackReason?: string | null;
  routePolicy?: Pick<RoutePolicyViewModel, 'automationAllowed' | 'requiresHumanReview' | 'requiresPaidWork'> | null;
}

export interface RoutePolicyInput {
  route: ExecutionRoute;
  complexityScore: number;
  riskScore: number;
  confidence: number;
  labels?: string[];
}

const AI_CONFIDENCE_THRESHOLD = 0.78;
const AI_MAX_COMPLEXITY = 5;
const AI_MAX_RISK = 4;
const HARD_BLOCK_LABELS = new Set(['security', 'auth', 'permissions', 'needs design', 'maintainer-review', 'migration', 'payment', 'decision-needed']);
const SAFE_AGENT_LABELS = new Set(['agent-solvable', 'bug', 'documentation', 'docs', 'test', 'testing', 'backend', 'frontend']);

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
  const labels = new Set((issue.labels ?? []).map(normalizeLabel));
  const existing = issue.classification;
  const complexityScore = clampScore((existing?.complexityScore ?? heuristicComplexity(issue)) + priorFailures);
  const riskScore = clampScore((existing?.riskScore ?? heuristicRisk(issue)) + Math.min(priorFailures, 2));
  const confidence = existing?.confidence ?? confidenceFor(issue, complexityScore, riskScore);
  let route: ExecutionRoute;
  let policyRationale: string | null = null;

  if (labels.has('needs reproduction') || labels.has('triage')) {
    route = 'close-or-clarify';
  } else if (labels.has('bounty') || labels.has('integration')) {
    route = 'bounty-worthy';
  } else if (hasHardBlockLabel(labels) || riskScore >= 7) {
    route = 'maintainer-review';
  } else if (hasSafeAgentLabel(labels)) {
    route = 'agent-solvable';
  } else {
    route = 'agent-solvable';
  }

  if (route === 'agent-solvable') {
    const aiPolicy = evaluateRoutePolicy({ route, complexityScore, riskScore, confidence, labels: [...labels] });
    if (!aiPolicy.automationAllowed) {
      policyRationale = aiPolicy.reasons.join(' ');
      route = 'maintainer-review';
    }
  }

  if (priorFailures >= 2 && route === 'agent-solvable') {
    policyRationale = `Prior sandbox or verification failures crossed the retry limit; rerouted after ${priorFailures} failed attempts.`;
    route = complexityScore >= 6 ? 'bounty-worthy' : 'maintainer-review';
  }

  if (route === 'maintainer-review' && !policyRationale) {
    const devPolicy = evaluateRoutePolicy({ route, complexityScore, riskScore, confidence, labels: [...labels] });
    policyRationale = devPolicy.reasons.join(' ');
  }

  if (route === 'bounty-worthy' && priorFailures >= 2 && !policyRationale) {
    policyRationale = `Repeated failures and complexity=${complexityScore} moved this to bounded paid work.`;
  }

  return {
    route,
    complexityScore,
    riskScore,
    confidence,
    rationale:
      policyRationale ??
      existing?.rationale ??
      `${route} because complexity=${complexityScore}, risk=${riskScore}, confidence=${Math.round(confidence * 100)}%.`,
  };
}

export function evaluateRoutePolicy(input: RoutePolicyInput): RoutePolicyViewModel {
  const labels = new Set((input.labels ?? []).map(normalizeLabel));
  const reasons: string[] = [];
  const safetyChecks = [
    'Fresh Greptile verification is required before completion.',
    'Sandbox execution is evidence only, not correctness proof.',
    'Preserve failed attempts and reroute reasons in the trace ledger.',
  ];

  if (input.route === 'bounty-worthy') {
    return {
      executionMode: 'clustly',
      automationAllowed: false,
      sandboxAllowed: false,
      requiresHumanReview: true,
      requiresPaidWork: true,
      reasons: ['CLUSTLY route becomes bounded paid work; AI automation does not start this issue.'],
      safetyChecks: [...safetyChecks, 'Release remains blocked until funded task, linked PR, fresh verification, and maintainer acceptance exist.'],
    };
  }

  const aiBlockers = aiGateReasons(input, labels);

  if (input.route === 'maintainer-review') {
    return {
      executionMode: 'dev',
      automationAllowed: false,
      sandboxAllowed: false,
      requiresHumanReview: true,
      requiresPaidWork: false,
      reasons: aiBlockers.length > 0
        ? ['DEV route is human-owned and never starts autonomous AI execution.', ...aiBlockers]
        : ['DEV route is human-owned and never starts autonomous AI execution.'],
      safetyChecks,
    };
  }

  if (input.route === 'close-or-clarify') {
    return {
      executionMode: 'clarify',
      automationAllowed: false,
      sandboxAllowed: false,
      requiresHumanReview: true,
      requiresPaidWork: false,
      reasons: ['Issue needs clarification before any implementation route is safe.'],
      safetyChecks: [...safetyChecks, 'Ask for reproduction or expected behavior before dispatch.'],
    };
  }

  reasons.push(...aiBlockers);

  return {
    executionMode: reasons.length === 0 ? 'ai' : 'dev',
    automationAllowed: reasons.length === 0,
    sandboxAllowed: reasons.length === 0,
    requiresHumanReview: reasons.length > 0,
    requiresPaidWork: false,
    reasons: reasons.length > 0 ? reasons : ['AI route passed deterministic risk, complexity, confidence, and label gates.'],
    safetyChecks,
  };
}

export function isAiSafe(input: RoutePolicyInput) {
  return evaluateRoutePolicy(input).automationAllowed;
}

export function selectClodModel(decision: RouteDecision, options: number | ModelSelectionOptions = 0): ModelSelection {
  const selection = typeof options === 'number' ? { priorFailures: options } : options;
  const priorFailures = selection.priorFailures ?? 0;

  if (selection.fallbackReason) {
    return {
      tier: 'premium-fallback',
      model: process.env.CLOD_PREMIUM_FALLBACK_MODEL || 'Claude Opus 4.5',
      reason: `Explicit fallback requested after provider/runtime failure: ${selection.fallbackReason}`,
    };
  }

  if (priorFailures >= 2 || decision.riskScore >= 8) {
    return {
      tier: 'deep',
      model: process.env.CLOD_DEEP_MODEL || 'DeepSeek V3',
      reason: 'High risk or repeated failure needs a deeper model before human/bounty escalation.',
    };
  }

  if (
    decision.complexityScore >= 6 ||
    decision.confidence < 0.8 ||
    selection.verificationStatus === 'failed' ||
    selection.verificationStatus === 'stale' ||
    selection.routePolicy?.requiresPaidWork === true
  ) {
    return {
      tier: 'balanced',
      model: process.env.CLOD_BALANCED_MODEL || 'GPT 4o',
      reason: 'Moderate complexity, lower confidence, failed verification, stale verification, or paid-work routing needs a balanced model for routing rationale.',
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
  const text = issue.title.toLowerCase();
  if (/\b(security|auth|permissions?)\b/.test(text)) return 8;
  if (/\b(migration|payment)\b/.test(text)) return 6;
  return 3;
}

function hasHardBlockLabel(labels: Set<string>) {
  return [...labels].some((label) => HARD_BLOCK_LABELS.has(label));
}

function hasSafeAgentLabel(labels: Set<string>) {
  return [...labels].some((label) => SAFE_AGENT_LABELS.has(label));
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function aiGateReasons(input: RoutePolicyInput, labels: Set<string>) {
  const reasons: string[] = [];
  if (input.riskScore > AI_MAX_RISK) reasons.push(`Risk score ${input.riskScore} exceeds AI gate ${AI_MAX_RISK}.`);
  if (input.complexityScore > AI_MAX_COMPLEXITY) reasons.push(`Complexity score ${input.complexityScore} exceeds AI gate ${AI_MAX_COMPLEXITY}.`);
  if (input.confidence < AI_CONFIDENCE_THRESHOLD) reasons.push(`Confidence ${Math.round(input.confidence * 100)}% is below AI gate ${Math.round(AI_CONFIDENCE_THRESHOLD * 100)}%.`);
  const hardLabels = [...labels].filter((label) => HARD_BLOCK_LABELS.has(label));
  if (hardLabels.length > 0) reasons.push(`Hard-block label(s): ${hardLabels.join(', ')}.`);
  return reasons;
}

function confidenceFor(issue: RawIssueLike, complexityScore: number, riskScore: number) {
  const labelBonus = Math.min((issue.labels?.length ?? 0) * 0.015, 0.06);
  const commentPenalty = Math.min((issue.commentsCount ?? 0) * 0.003, 0.08);
  return Number(Math.max(0.55, Math.min(0.98, 0.93 - complexityScore * 0.015 - riskScore * 0.01 + labelBonus - commentPenalty)).toFixed(2));
}

function clampScore(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
}
