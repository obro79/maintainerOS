import { redactAgentCommandForEvidence } from './agent-command-evidence';
import { parseAgentPatchPackage, type AgentPatchPackage } from './agent-patch-package';
import { recordProviderRun } from './provider-runs';
import type { IssueDetailViewModel, PullRequestViewModel, SandboxCommandResultViewModel, SandboxExecutionViewModel } from './types';

export interface AgentExecutionResult {
  ok: boolean;
  blocked: boolean;
  error: string | null;
  patchPackage: AgentPatchPackage | null;
  attempt: SandboxExecutionViewModel | null;
  pullRequest: PullRequestViewModel | null;
}

interface DaytonaCommandResponse {
  exitCode?: number;
  code?: number;
  stdout?: string;
  stderr?: string;
  output?: string;
}

interface GitHubPullRequestResponse {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  merged_at?: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string } | null;
}

export async function runAgentExecution(issue: IssueDetailViewModel, repositoryId: string): Promise<AgentExecutionResult> {
  assertRepositoryId(repositoryId);

  if (issue.route !== 'agent-solvable' || !issue.routePolicy.automationAllowed) {
    return {
      ok: false,
      blocked: true,
      error: issue.routePolicy.reasons.join(' ') || 'Route policy blocks autonomous agent execution.',
      patchPackage: null,
      attempt: null,
      pullRequest: null,
    };
  }

  const patchPackage = await generateClodPatchPackage(issue, repositoryId);
  const sandboxId = await createDaytonaSandbox(repositoryId, issue.number);
  const commands = executionCommands(repositoryId, issue, patchPackage);
  const commandResults: SandboxCommandResultViewModel[] = [];

  try {
    for (const command of commands) {
      commandResults.push(await runDaytonaCommand(sandboxId, command));
    }
    const failed = commandResults.find((command) => command.status === 'failed');
    const headSha = [...commandResults].reverse().find((command) => command.command === 'git rev-parse HEAD')?.summary.trim() || 'unknown';
    const attempt = buildAttempt(issue, repositoryId, sandboxId, patchPackage, commandResults, failed?.summary ?? null);
    const pullRequest = failed ? null : await createGitHubPullRequest(repositoryId, patchPackage, issue.number, headSha);

    await recordProviderRun({
      provider: 'daytona',
      purpose: 'run-agent',
      status: failed ? 'failed' : 'succeeded',
      sourceState: 'live',
      repositoryId,
      issueNumber: issue.number,
      runId: sandboxId,
      artifactUrl: pullRequest?.htmlUrl ?? null,
      latencyMs: totalDuration(commandResults),
      errorMessage: failed?.summary ?? null,
      requestMeta: { branchName: patchPackage.branchName, filesIntended: patchPackage.filesIntended },
      responseMeta: { commandResults, pullRequest, patchSummary: patchPackage.summary },
    });

    return {
      ok: !failed,
      blocked: false,
      error: failed?.summary ?? null,
      patchPackage,
      attempt: pullRequest ? { ...attempt, pullRequestUrl: pullRequest.htmlUrl } : attempt,
      pullRequest,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown agent execution error.';
    await recordProviderRun({
      provider: 'daytona',
      purpose: 'run-agent',
      status: 'failed',
      sourceState: 'live',
      repositoryId,
      issueNumber: issue.number,
      runId: sandboxId,
      errorMessage: message,
      responseMeta: { commandResults, patchSummary: patchPackage.summary },
    });
    return { ok: false, blocked: false, error: message, patchPackage, attempt: buildAttempt(issue, repositoryId, sandboxId, patchPackage, commandResults, message), pullRequest: null };
  }
}

export async function generateClodPatchPackage(issue: IssueDetailViewModel, repositoryId: string): Promise<AgentPatchPackage> {
  if (!process.env.CLOD_API_KEY) throw new Error('CLOD_API_KEY is required to generate an agent patch.');
  const baseUrl = (process.env.CLOD_BASE_URL || 'https://api.clod.io/v1').replace(/\/$/, '');
  const repositorySnapshot = await buildRepositorySnapshot(repositoryId, issue);
  const firstPayload = await requestClodPatchPayload(baseUrl, issue, repositoryId, repositorySnapshot, true);
  try {
    return parseAgentPatchPackage(firstPayload?.choices?.[0]?.message?.content);
  } catch (error) {
    const retryPayload = await requestClodPatchPayload(baseUrl, issue, repositoryId, repositorySnapshot, false);
    try {
      return parseAgentPatchPackage(retryPayload?.choices?.[0]?.message?.content);
    } catch {
      const message = error instanceof Error ? error.message : 'CLŌD patch response was not valid JSON.';
      const finishReason = stringValue(firstPayload?.choices?.[0]?.finish_reason);
      const content = firstPayload?.choices?.[0]?.message?.content;
      const contentLength = typeof content === 'string' ? content.length : 0;
      throw new Error(`${message} finish_reason=${finishReason || 'unknown'} content_length=${contentLength}`);
    }
  }
}

async function requestClodPatchPayload(
  baseUrl: string,
  issue: IssueDetailViewModel,
  repositoryId: string,
  repositorySnapshot: RepositorySnapshot,
  includeContextPack: boolean,
) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLOD_BALANCED_MODEL || process.env.CLOD_CHEAP_MODEL || 'DeepSeek V3',
      reasoning_effort: process.env.CLOD_AGENT_REASONING_EFFORT || 'low',
      max_completion_tokens: Number(process.env.CLOD_AGENT_MAX_COMPLETION_TOKENS || 6000),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Return one JSON object only. No markdown.',
            'Required schema: {summary:string, branchName:string, commitMessage:string, filesIntended:string[], unifiedDiff:string, verificationCommands:string[]}.',
            'filesIntended must be an array of file paths, not a map.',
            'unifiedDiff must be one git apply compatible patch string beginning with diff --git.',
            'Use repositorySnapshot before writing the diff. Existing files must be modified with real context, not recreated as new files.',
            'Keep changes scoped to the issue and do not include unrelated files.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            repositoryId,
            issue: { number: issue.number, title: issue.title, body: issue.body, labels: issue.labels },
            workOrder: issue.workOrder,
            repositorySnapshot,
            contextPack: includeContextPack ? issue.contextPack : null,
          }),
        },
      ],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `CLŌD patch request failed with ${response.status}.`);
  return payload;
}

interface RepositorySnapshot {
  defaultRef: string;
  files: Array<{ path: string; exists: boolean; content: string }>;
}

interface GitHubTreeResponse {
  tree?: Array<{ path?: string; type?: string; size?: number }>;
}

interface GitHubContentResponse {
  type?: string;
  encoding?: string;
  content?: string;
}

async function buildRepositorySnapshot(repositoryId: string, issue: IssueDetailViewModel): Promise<RepositorySnapshot> {
  const [owner, repo] = repositoryId.split('/');
  const defaultRef = 'main';
  const suggestedFiles = issue.workOrder.suggestedFiles.filter(Boolean);
  if (!suggestedFiles.length) return { defaultRef, files: [] };

  const tree = await githubJson<GitHubTreeResponse>(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultRef}?recursive=1`);
  const paths = (tree.tree ?? [])
    .filter((item) => item.type === 'blob' && item.path && (item.size ?? 0) <= 20_000)
    .map((item) => item.path as string)
    .filter((path) => suggestedFiles.some((suggested) => suggested.endsWith('/') ? path.startsWith(suggested) : path === suggested))
    .slice(0, 8);

  const files = await Promise.all(paths.map(async (path) => {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const content = await githubJson<GitHubContentResponse>(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${defaultRef}`);
    return {
      path,
      exists: content.type === 'file',
      content: content.encoding === 'base64' && content.content
        ? Buffer.from(content.content, 'base64').toString('utf8').slice(0, 12_000)
        : '',
    };
  }));

  return { defaultRef, files };
}

async function githubJson<T>(url: string): Promise<T> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'MaintainerOS-agent',
  };
  const token = githubWorkflowToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) return {} as T;
  return response.json().catch(() => ({})) as Promise<T>;
}

function executionCommands(repositoryId: string, issue: IssueDetailViewModel, patchPackage: AgentPatchPackage) {
  const token = githubWorkflowToken();
  if (!token) throw new Error('GITHUB_TOKEN is required for agent branch push and PR creation.');
  const [owner, repo] = repositoryId.split('/');
  const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  const encodedPatch = Buffer.from(patchPackage.unifiedDiff, 'utf8').toString('base64');
  return [
    `rm -rf /tmp/maintaineros-agent-${issue.number}`,
    `git clone ${shellQuote(cloneUrl)} /tmp/maintaineros-agent-${issue.number}`,
    `cd /tmp/maintaineros-agent-${issue.number} && git config user.name 'MaintainerOS Agent' && git config user.email 'maintaineros-agent@users.noreply.github.com'`,
    `cd /tmp/maintaineros-agent-${issue.number} && git switch -c ${shellQuote(patchPackage.branchName)}`,
    `cd /tmp/maintaineros-agent-${issue.number} && printf %s ${shellQuote(encodedPatch)} | base64 -d > /tmp/maintaineros-agent-${issue.number}.patch && git apply /tmp/maintaineros-agent-${issue.number}.patch`,
    `cd /tmp/maintaineros-agent-${issue.number} && git diff --check`,
    ...safeVerificationCommands(patchPackage.verificationCommands).map((command) => `cd /tmp/maintaineros-agent-${issue.number} && ${command}`),
    `cd /tmp/maintaineros-agent-${issue.number} && git add ${patchPackage.filesIntended.map(shellQuote).join(' ')} && git commit -m ${shellQuote(patchPackage.commitMessage)}`,
    `cd /tmp/maintaineros-agent-${issue.number} && git push origin ${shellQuote(patchPackage.branchName)}`,
    `cd /tmp/maintaineros-agent-${issue.number} && git rev-parse HEAD`,
  ];
}

async function createDaytonaSandbox(repositoryId: string, issueNumber: number) {
  if (!process.env.DAYTONA_API_KEY) throw new Error('DAYTONA_API_KEY is required to create an agent sandbox.');
  const baseUrl = (process.env.DAYTONA_API_URL || process.env.DAYTONA_BASE_URL || 'https://app.daytona.io/api').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/sandbox`, {
    method: 'POST',
    headers: daytonaHeaders(),
    body: JSON.stringify({
      name: `maintaineros-${issueNumber}-${Date.now()}`,
      target: process.env.DAYTONA_TARGET || 'us',
      labels: { repositoryId, issueNumber: String(issueNumber), product: 'maintaineros' },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Daytona sandbox create failed with ${response.status}.`);
  return String(payload.id ?? payload.sandboxId ?? payload.name);
}

async function runDaytonaCommand(sandboxId: string, command: string): Promise<SandboxCommandResultViewModel> {
  const startedAt = Date.now();
  const response = await fetch(`https://proxy.app.daytona.io/toolbox/${encodeURIComponent(sandboxId)}/process/execute`, {
    method: 'POST',
    headers: daytonaHeaders(),
    body: JSON.stringify({ command }),
  });
  const payload = await response.json().catch(() => ({})) as DaytonaCommandResponse;
  const exitCode = payload.exitCode ?? payload.code ?? (response.ok ? 0 : 1);
  const output = payload.stdout ?? payload.output ?? payload.stderr ?? response.statusText;
  return {
    command: redactAgentCommandForEvidence(command),
    status: response.ok && exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    durationMs: Date.now() - startedAt,
    summary: redactAgentCommandForEvidence(String(output)).slice(0, 500),
  };
}

async function createGitHubPullRequest(repositoryId: string, patchPackage: AgentPatchPackage, issueNumber: number, headSha: string): Promise<PullRequestViewModel> {
  const [owner, repo] = repositoryId.split('/');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubWorkflowToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'MaintainerOS-agent',
    },
    body: JSON.stringify({
      title: patchPackage.commitMessage,
      head: patchPackage.branchName,
      base: 'main',
      body: `${patchPackage.summary}\n\nCloses #${issueNumber}`,
    }),
  });
  const payload = await response.json().catch(() => ({})) as GitHubPullRequestResponse & { message?: string };
  if (!response.ok) throw new Error(payload.message || `GitHub PR creation failed with ${response.status}.`);
  return {
    provider: 'github',
    sourceState: 'live',
    number: payload.number,
    title: payload.title,
    baseBranch: payload.base.ref,
    branchName: payload.head.ref,
    headSha: payload.head.sha || headSha,
    status: payload.merged_at ? 'merged' : payload.draft ? 'draft' : payload.state === 'closed' ? 'closed' : 'open',
    htmlUrl: payload.html_url,
    authorLogin: payload.user?.login ?? 'maintaineros-agent',
    authorOwnerType: 'automation',
    automationOwned: true,
    linkedAt: new Date().toISOString(),
  };
}

function buildAttempt(
  issue: IssueDetailViewModel,
  repositoryId: string,
  sandboxId: string,
  patchPackage: AgentPatchPackage,
  commandResults: SandboxCommandResultViewModel[],
  failureReason: string | null,
): SandboxExecutionViewModel {
  const completedCommands = commandResults.filter((command) => command.status === 'passed').map((command) => command.command);
  return {
    provider: 'daytona',
    sourceState: 'live',
    id: `daytona-${repositoryId}-${issue.number}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    status: failureReason ? 'failed' : 'passed',
    sandboxId,
    imageOrTemplate: process.env.DAYTONA_TARGET || 'daytonaio/sandbox:0.6.0',
    repoRef: `${repositoryId}@main`,
    branchName: patchPackage.branchName,
    contextMode: issue.contextPack?.id ? 'nia-enriched' : 'baseline',
    contextPackId: issue.contextPack?.id ?? null,
    requestedCommands: commandResults.map((command) => command.command),
    completedCommands,
    durationMs: totalDuration(commandResults),
    exitCode: failureReason ? 1 : 0,
    commandResults,
    logSummary: failureReason ? `Agent sandbox failed: ${failureReason}` : patchPackage.summary,
    filesTouched: patchPackage.filesIntended,
    pullRequestUrl: null,
    failureReason,
  };
}

function daytonaHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.DAYTONA_API_KEY || ''}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function totalDuration(commandResults: SandboxCommandResultViewModel[]) {
  return commandResults.reduce((total, command) => total + (command.durationMs ?? 0), 0);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function githubWorkflowToken() {
  return process.env.GITHUB_TOKEN?.trim();
}

function safeVerificationCommands(commands: string[]) {
  const allowedPrefixes = ['npm ', 'npm test', 'pnpm ', 'yarn ', 'bun ', 'node ', 'npx ', 'tsc ', 'grep ', 'ls ', 'test '];
  return commands
    .map((command) => command.trim())
    .filter((command) => allowedPrefixes.some((prefix) => command === prefix.trim() || command.startsWith(prefix)))
    .filter((command) => !/[;&|<>`$]/.test(command))
    .slice(0, 5);
}

function assertRepositoryId(repositoryId: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryId)) {
    throw new Error('repositoryId must be formatted as owner/repo.');
  }
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
