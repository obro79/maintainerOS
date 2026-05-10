import { NextResponse } from 'next/server';
import type { ProviderKey } from '@/lib/maintaineros/types';
import {
  blockedProviderResult,
  getProviderHealth,
  getProviderRuntimeConfig,
  offlineProviderResult,
  type ProviderCallResult,
} from '@/lib/maintaineros/provider-runtime';
import { recordProviderCallResult } from '@/lib/maintaineros/provider-runs';
import { hasNeonConnection, withPostgres } from '@/lib/maintaineros/postgres';

export const runtime = 'nodejs';

const PROVIDERS: ProviderKey[] = ['github', 'neon', 'clod', 'nia', 'daytona', 'greptile', 'clustly'];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const requested = typeof body.provider === 'string' ? [body.provider as ProviderKey] : PROVIDERS;
  const providers = requested.filter((provider): provider is ProviderKey => PROVIDERS.includes(provider));

  if (providers.length === 0) {
    return NextResponse.json({ ok: false, error: 'provider must be one of github, neon, clod, nia, daytona, greptile, clustly.' }, { status: 400 });
  }

  const results = [];
  for (const provider of providers) {
    const result = await smokeProvider(provider);
    await recordProviderCallResult('smoke', result, {
      requestMeta: { provider },
      responseMeta: { detail: result.detail },
    });
    results.push(result);
  }

  return NextResponse.json({
    ok: results.every((result) => result.status === 'succeeded' || result.status === 'offline-skipped'),
    runtime: getProviderRuntimeConfig(),
    results,
  });
}

async function smokeProvider(provider: ProviderKey): Promise<ProviderCallResult> {
  const startedAt = Date.now();
  const runtime = getProviderRuntimeConfig();
  const health = getProviderHealth(provider);

  if (runtime.offline) {
    return offlineProviderResult(provider, 'Offline mode is enabled; smoke call skipped.');
  }
  if (!health?.configured) {
    return blockedProviderResult(provider, health?.detail ?? 'Provider config is missing.');
  }

  try {
    if (provider === 'neon') return await smokeNeon(startedAt);
    if (provider === 'github') return await smokeGitHub(startedAt);
    if (provider === 'clod') return await smokeClod(startedAt);
    if (provider === 'clustly') return await smokeClustly(startedAt);
    return await smokeGenericProvider(provider, startedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provider smoke failure.';
    return {
      provider,
      status: 'failed',
      sourceState: 'live',
      skipped: false,
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
      detail: message,
    };
  }
}

async function smokeNeon(startedAt: number): Promise<ProviderCallResult> {
  if (!hasNeonConnection()) return blockedProviderResult('neon', 'DATABASE_URL is missing.');
  const result = await withPostgres((client) => client.query<{ ok: number }>('select 1 as ok'));
  return {
    provider: 'neon',
    status: 'succeeded',
    sourceState: 'live',
    skipped: false,
    artifact: { rowCount: result.rows.length },
    latencyMs: Date.now() - startedAt,
    errorMessage: null,
    detail: 'Neon query succeeded.',
  };
}

async function smokeGitHub(startedAt: number): Promise<ProviderCallResult> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'MaintainerOS-provider-smoke',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch('https://api.github.com/rate_limit', { headers });
  if (!response.ok) throw new Error(`GitHub smoke failed with ${response.status}.`);
  const payload = await response.json();
  return {
    provider: 'github',
    status: 'succeeded',
    sourceState: 'live',
    skipped: false,
    artifact: { rateLimitRemaining: payload?.rate?.remaining ?? null },
    latencyMs: Date.now() - startedAt,
    errorMessage: null,
    detail: 'GitHub rate-limit endpoint succeeded.',
  };
}

async function smokeClod(startedAt: number): Promise<ProviderCallResult> {
  const baseUrl = (process.env.CLOD_BASE_URL || 'https://api.clod.io/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLOD_CHEAP_MODEL || 'DeepSeek V3',
      temperature: 0,
      max_completion_tokens: 20,
      messages: [
        { role: 'system', content: 'Return strict JSON.' },
        { role: 'user', content: '{"ok":true}' },
      ],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `CLōD smoke failed with ${response.status}.`);
  return {
    provider: 'clod',
    status: 'succeeded',
    sourceState: 'live',
    skipped: false,
    artifact: { model: process.env.CLOD_CHEAP_MODEL || 'DeepSeek V3', usage: payload?.usage ?? null },
    latencyMs: Date.now() - startedAt,
    errorMessage: null,
    detail: 'CLōD chat completion smoke call succeeded.',
  };
}

async function smokeClustly(startedAt: number): Promise<ProviderCallResult> {
  const baseUrl = (process.env.CLUSTLY_BASE_URL || 'https://clustly.ai/api/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/tasks/open`, {
    headers: {
      'x-agent-key': process.env.CLUSTLY_AGENT_KEY || '',
      Accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Clustly smoke failed with ${response.status}.`);
  return {
    provider: 'clustly',
    status: 'succeeded',
    sourceState: 'live',
    skipped: false,
    artifact: { openTaskCount: Array.isArray(payload) ? payload.length : payload?.tasks?.length ?? null },
    latencyMs: Date.now() - startedAt,
    errorMessage: null,
    detail: 'Clustly open-task smoke call succeeded.',
  };
}

async function smokeGenericProvider(provider: ProviderKey, startedAt: number): Promise<ProviderCallResult> {
  const envPrefix = provider.toUpperCase();
  const baseUrl = process.env[`${envPrefix}_BASE_URL`];
  const apiKey = process.env[`${envPrefix}_API_KEY`];
  if (!baseUrl) return blockedProviderResult(provider, `${envPrefix}_BASE_URL is required before this provider smoke call can run.`);

  const response = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`${provider} smoke failed with ${response.status}.`);
  return {
    provider,
    status: 'succeeded',
    sourceState: 'live',
    skipped: false,
    artifact: { endpoint: baseUrl.replace(/:\/\/[^@]+@/, '://') },
    latencyMs: Date.now() - startedAt,
    errorMessage: null,
    detail: `${provider} base endpoint smoke call succeeded.`,
  };
}
