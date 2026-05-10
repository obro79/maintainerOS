import type { ArtifactSourceState, ProviderKey } from './types';
import { hasNeonConnection } from './postgres';

export type ProviderRuntimeMode = 'offline' | 'online';
export type ProviderRunStatus = 'offline-skipped' | 'blocked' | 'running' | 'succeeded' | 'failed';

export interface ProviderHealthViewModel {
  provider: ProviderKey;
  label: string;
  mode: ProviderRuntimeMode;
  sourceState: ArtifactSourceState;
  status: ProviderRunStatus;
  configured: boolean;
  requiredEnv: string[];
  missingEnv: string[];
  baseUrl?: string;
  detail: string;
}

export interface ProviderRuntimeConfig {
  mode: ProviderRuntimeMode;
  offline: boolean;
  providers: ProviderHealthViewModel[];
}

export interface ProviderCallResult<TArtifact = unknown> {
  provider: ProviderKey;
  status: ProviderRunStatus;
  sourceState: ArtifactSourceState;
  skipped: boolean;
  artifact?: TArtifact;
  latencyMs: number;
  errorMessage: string | null;
  detail: string;
}

interface ProviderDefinition {
  provider: ProviderKey;
  label: string;
  requiredEnv: string[];
  baseUrlEnv?: string;
}

const PROVIDERS: ProviderDefinition[] = [
  { provider: 'github', label: 'GitHub', requiredEnv: [], baseUrlEnv: 'GITHUB_API_BASE_URL' },
  { provider: 'neon', label: 'Neon', requiredEnv: ['DATABASE_URL'] },
  { provider: 'clod', label: 'CLōD', requiredEnv: ['CLOD_API_KEY'], baseUrlEnv: 'CLOD_BASE_URL' },
  { provider: 'nia', label: 'Nia', requiredEnv: ['NIA_API_KEY'], baseUrlEnv: 'NIA_BASE_URL' },
  { provider: 'daytona', label: 'Daytona', requiredEnv: ['DAYTONA_API_KEY'], baseUrlEnv: 'DAYTONA_BASE_URL' },
  { provider: 'greptile', label: 'Greptile', requiredEnv: ['GREPTILE_API_KEY'], baseUrlEnv: 'GREPTILE_BASE_URL' },
  { provider: 'clustly', label: 'Clustly', requiredEnv: ['CLUSTLY_AGENT_KEY'], baseUrlEnv: 'CLUSTLY_BASE_URL' },
];

export function isOfflineMode() {
  return process.env.MAINTAINEROS_OFFLINE_MODE !== 'false';
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const offline = isOfflineMode();
  const mode: ProviderRuntimeMode = offline ? 'offline' : 'online';
  return {
    mode,
    offline,
    providers: PROVIDERS.map((definition) => providerHealth(definition, mode)),
  };
}

export function getProviderHealth(provider: ProviderKey) {
  return getProviderRuntimeConfig().providers.find((item) => item.provider === provider) ?? null;
}

export function blockedProviderResult<TArtifact>(provider: ProviderKey, detail: string, latencyMs = 0): ProviderCallResult<TArtifact> {
  return {
    provider,
    status: 'blocked',
    sourceState: 'planned',
    skipped: true,
    latencyMs,
    errorMessage: detail,
    detail,
  };
}

export function offlineProviderResult<TArtifact>(provider: ProviderKey, detail: string, artifact?: TArtifact): ProviderCallResult<TArtifact> {
  return {
    provider,
    status: 'offline-skipped',
    sourceState: 'fixture',
    skipped: true,
    artifact,
    latencyMs: 0,
    errorMessage: null,
    detail,
  };
}

function providerHealth(definition: ProviderDefinition, mode: ProviderRuntimeMode): ProviderHealthViewModel {
  const missingEnv = mode === 'offline' ? [] : missingEnvFor(definition);
  const configured = missingEnv.length === 0;
  const baseUrl = definition.baseUrlEnv ? process.env[definition.baseUrlEnv] : undefined;

  if (mode === 'offline') {
    return {
      provider: definition.provider,
      label: definition.label,
      mode,
      sourceState: 'fixture',
      status: 'offline-skipped',
      configured: false,
      requiredEnv: definition.requiredEnv,
      missingEnv,
      baseUrl: redactUrl(baseUrl),
      detail: 'Offline mode is enabled; this provider will not make external API calls.',
    };
  }

  return {
    provider: definition.provider,
    label: definition.label,
    mode,
    sourceState: configured ? 'live' : 'planned',
    status: configured ? 'running' : 'blocked',
    configured,
    requiredEnv: definition.requiredEnv,
    missingEnv,
    baseUrl: redactUrl(baseUrl),
    detail: configured ? onlineReadyDetail(definition.provider) : `Missing env: ${missingEnv.join(', ')}`,
  };
}

function missingEnvFor(definition: ProviderDefinition) {
  if (definition.provider === 'neon') return hasNeonConnection() ? [] : ['DATABASE_URL'];
  return definition.requiredEnv.filter((key) => !process.env[key]);
}

function redactUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return value.replace(/:\/\/[^@]+@/, '://');
  }
}

function onlineReadyDetail(provider: ProviderKey) {
  if (provider === 'github' && !process.env.GITHUB_TOKEN) {
    return 'Public GitHub API is available without a token; add GITHUB_TOKEN for private repos or higher rate limits.';
  }
  return 'Provider config is present; smoke test can attempt a real call.';
}
