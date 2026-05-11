import type { IssueDetailViewModel, ModelRunViewModel } from './types';
import { estimatePremiumBaselineCents, scoreIssue, selectClodModel } from './routing';
import { getProviderHealth, isOfflineMode } from './provider-runtime';
import { recordProviderRun } from './provider-runs';
import { buildClodRunEvidenceMeta } from './clod-run-evidence';

export interface ClodRouteResult {
  ok: boolean;
  skipped: boolean;
  blocked?: boolean;
  fallbackReason?: string | null;
  artifact: {
    summary: string;
    rationale: string;
    acceptanceChecks: string[];
  };
  modelRun: ModelRunViewModel;
  error?: string;
}

export async function generateClodRoutingArtifact(issue: IssueDetailViewModel): Promise<ClodRouteResult> {
  const decision = scoreIssue({
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
    classification: {
      route: issue.route,
      confidence: issue.confidence / 100,
      complexityScore: complexityScore(issue.complexity),
      riskScore: riskScore(issue.risk),
      rationale: issue.rationale,
    },
  });
  const selection = selectClodModel(decision, {
    verificationStatus: issue.verification?.status ?? null,
    routePolicy: issue.routePolicy,
  });
  const startedAt = Date.now();
  const createdAt = new Date().toISOString();
  const runId = `clod-${issue.id}-${Date.now()}`;
  const fallbackRun: ModelRunViewModel = {
    provider: 'clod',
    id: runId,
    runId,
    createdAt,
    sourceState: isOfflineMode() ? 'fixture' : process.env.CLOD_API_KEY ? 'live' : 'planned',
    model: selection.model,
    tier: selection.tier,
    purpose: 'work-order',
    status: 'fallback',
    selectionReason: selection.reason,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
    estimatedCostCents: null,
    premiumBaselineCents: null,
    fallbackReason: null,
  };

  if (isOfflineMode()) {
    const fallbackReason = 'MAINTAINEROS_OFFLINE_MODE is enabled; CLōD API call skipped.';
    await recordProviderRun({
      provider: 'clod',
      purpose: 'work-order',
      status: 'offline-skipped',
      sourceState: 'fixture',
      issueNumber: issue.number,
      runId,
      latencyMs: 0,
      errorMessage: null,
      requestMeta: { issueId: issue.id, issueNumber: issue.number, route: issue.route, model: selection.model, tier: selection.tier },
      responseMeta: buildClodRunEvidenceMeta({
        issue,
        modelRun: {
          ...fallbackRun,
          sourceState: 'fixture',
          fallbackReason,
        },
        routeConfidence: decision.confidence,
        routeComplexityScore: decision.complexityScore,
        routeRiskScore: decision.riskScore,
      }),
    });
    return {
      ok: false,
      skipped: true,
      artifact: deterministicArtifact(issue),
      fallbackReason,
      modelRun: {
        ...fallbackRun,
        sourceState: 'fixture',
        fallbackReason,
      },
      error: fallbackReason,
    };
  }

  if (!process.env.CLOD_API_KEY) {
    const fallbackReason = getProviderHealth('clod')?.detail ?? 'CLOD_API_KEY is not configured.';
    await recordProviderRun({
      provider: 'clod',
      purpose: 'work-order',
      status: 'blocked',
      sourceState: 'planned',
      issueNumber: issue.number,
      runId,
      latencyMs: 0,
      errorMessage: fallbackReason,
      requestMeta: { issueId: issue.id, issueNumber: issue.number, route: issue.route, model: selection.model, tier: selection.tier },
      responseMeta: buildClodRunEvidenceMeta({
        issue,
        modelRun: {
          ...fallbackRun,
          sourceState: 'planned',
          fallbackReason,
        },
        routeConfidence: decision.confidence,
        routeComplexityScore: decision.complexityScore,
        routeRiskScore: decision.riskScore,
      }),
    });
    return {
      ok: false,
      skipped: true,
      blocked: true,
      artifact: deterministicArtifact(issue),
      fallbackReason,
      modelRun: {
        ...fallbackRun,
        sourceState: 'planned',
        fallbackReason,
      },
      error: fallbackReason,
    };
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    const baseUrl = (process.env.CLOD_BASE_URL || 'https://api.clod.io/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timeoutMs = Math.max(Number(process.env.CLOD_TIMEOUT_MS || 0) || 0, 300000);
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.CLOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selection.model,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are MaintainerOS. Return only compact JSON: {"summary":"one sentence","rationale":"one sentence","acceptanceChecks":["check 1","check 2","check 3"]}. Do not include markdown.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              issue: {
                number: issue.number,
                title: issue.title,
                body: issue.body,
                labels: issue.labels,
              },
              deterministicRoute: issue.route,
              decision,
            }),
          },
        ],
      }),
    });
    if (timeout) clearTimeout(timeout);
    timeout = null;

    const latencyMs = Date.now() - startedAt;
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || `CLōD request failed with ${response.status}`);
    }

    const content = payload?.choices?.[0]?.message?.content;
    const parsed = parseArtifact(content);
    const inputTokens = payload?.usage?.prompt_tokens ?? null;
    const outputTokens = payload?.usage?.completion_tokens ?? null;
    const estimatedCostCents = estimateClodCostCents(inputTokens, outputTokens, selection.tier);
    const premiumBaselineCents = estimatePremiumBaselineCents(estimatedCostCents, selection.tier);

    if (!parsed.artifact) {
      const fallbackReason = parsed.error ?? 'CLōD response could not be normalized.';
      const modelRun: ModelRunViewModel = {
        ...fallbackRun,
        status: 'fallback',
        latencyMs,
        inputTokens,
        outputTokens,
        estimatedCostCents,
        premiumBaselineCents,
        fallbackReason,
      };
      await recordProviderRun({
        provider: 'clod',
        purpose: 'work-order',
        status: 'failed',
        sourceState: 'live',
        issueNumber: issue.number,
        runId,
        latencyMs,
        errorMessage: fallbackReason,
        requestMeta: { issueId: issue.id, issueNumber: issue.number, model: selection.model, tier: selection.tier, route: issue.route },
        responseMeta: buildClodRunEvidenceMeta({
          issue,
          modelRun,
          routeConfidence: decision.confidence,
          routeComplexityScore: decision.complexityScore,
          routeRiskScore: decision.riskScore,
        }),
      });
      return {
        ok: false,
        skipped: false,
        fallbackReason,
        artifact: deterministicArtifact(issue),
        modelRun,
        error: fallbackReason,
      };
    }

    const modelRun: ModelRunViewModel = {
      ...fallbackRun,
      status: 'succeeded',
      latencyMs,
      inputTokens,
      outputTokens,
      estimatedCostCents,
      premiumBaselineCents,
      fallbackReason: null,
    };
    await recordProviderRun({
      provider: 'clod',
      purpose: 'work-order',
      status: 'succeeded',
      sourceState: 'live',
      issueNumber: issue.number,
      runId,
      latencyMs,
      errorMessage: null,
      requestMeta: { issueId: issue.id, issueNumber: issue.number, model: selection.model, tier: selection.tier, route: issue.route },
      responseMeta: buildClodRunEvidenceMeta({
        issue,
        modelRun,
        routeConfidence: decision.confidence,
        routeComplexityScore: decision.complexityScore,
        routeRiskScore: decision.riskScore,
      }),
    });

    return {
      ok: true,
      skipped: false,
      fallbackReason: null,
      artifact: parsed.artifact,
      modelRun,
    };
  } catch (error) {
    if (timeout) clearTimeout(timeout);
    const fallbackReason = error instanceof Error ? error.message : 'Unknown CLōD error.';
    const fallbackSelection = selectClodModel(decision, {
      verificationStatus: issue.verification?.status ?? null,
      routePolicy: issue.routePolicy,
      fallbackReason,
    });
    const modelRun: ModelRunViewModel = {
      ...fallbackRun,
      model: fallbackSelection.model,
      tier: fallbackSelection.tier,
      selectionReason: fallbackSelection.reason,
      status: 'fallback',
      latencyMs: Date.now() - startedAt,
      fallbackReason,
    };
    await recordProviderRun({
      provider: 'clod',
      purpose: 'work-order',
      status: 'failed',
      sourceState: 'live',
      issueNumber: issue.number,
      runId,
      latencyMs: modelRun.latencyMs,
      errorMessage: fallbackReason,
      requestMeta: { issueId: issue.id, issueNumber: issue.number, model: selection.model, tier: selection.tier, route: issue.route },
      responseMeta: buildClodRunEvidenceMeta({
        issue,
        modelRun,
        routeConfidence: decision.confidence,
        routeComplexityScore: decision.complexityScore,
        routeRiskScore: decision.riskScore,
      }),
    });
    return {
      ok: false,
      skipped: false,
      fallbackReason,
      artifact: deterministicArtifact(issue),
      modelRun,
      error: fallbackReason,
    };
  }
}

function parseArtifact(content: unknown): { artifact: ClodRouteResult['artifact'] | null; error: string | null } {
  if (typeof content !== 'string') return { artifact: null, error: 'CLōD response did not include message content.' };
  try {
    const parsed = JSON.parse(content) as Partial<ClodRouteResult['artifact']>;
    if (!parsed.summary || !parsed.rationale || !Array.isArray(parsed.acceptanceChecks)) {
      return { artifact: null, error: 'CLōD response JSON was missing summary, rationale, or acceptanceChecks.' };
    };
    return {
      artifact: {
        summary: parsed.summary,
        rationale: parsed.rationale,
        acceptanceChecks: parsed.acceptanceChecks.map(String).slice(0, 5),
      },
      error: null,
    };
  } catch {
    return { artifact: null, error: 'CLōD response was not valid JSON.' };
  }
}

function deterministicArtifact(issue: IssueDetailViewModel): ClodRouteResult['artifact'] {
  return {
    summary: issue.workOrder.title,
    rationale: issue.rationale,
    acceptanceChecks: issue.workOrder.acceptanceChecks,
  };
}

function estimateClodCostCents(inputTokens: number | null, outputTokens: number | null, tier: ModelRunViewModel['tier']) {
  if (inputTokens == null && outputTokens == null) return null;
  const totalTokens = (inputTokens ?? 0) + (outputTokens ?? 0);
  if (totalTokens <= 0) return null;
  const centsPerThousandTokens: Record<ModelRunViewModel['tier'], number> = {
    'cheap-open': 0.08,
    balanced: 0.4,
    deep: 0.75,
    'premium-fallback': 1.5,
  };
  return Math.max(1, Math.round((totalTokens / 1000) * centsPerThousandTokens[tier]));
}

function complexityScore(value: IssueDetailViewModel['complexity']) {
  if (value === 'low') return 2;
  if (value === 'medium') return 5;
  if (value === 'high') return 8;
  return 4;
}

function riskScore(value: IssueDetailViewModel['risk']) {
  if (value === 'low') return 2;
  if (value === 'medium') return 5;
  return 8;
}
