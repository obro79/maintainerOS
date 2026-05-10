import { exec, execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseAgentPatchPackage, type AgentPatchPackage } from './agent-patch-package';
import { recordProviderRun } from './provider-runs';
import type { IssueDetailViewModel, PullRequestViewModel, SandboxCommandResultViewModel, SandboxExecutionViewModel } from './types';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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
  const backend = resolveAgentExecutionBackend();

  if (backend === 'local') {
    return runLocalAgentExecution(issue, repositoryId, patchPackage);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) throw new Error('GITHUB_TOKEN is required for Daytona agent branch push and PR creation.');
  const baseBranch = await getGitHubDefaultBranch(repositoryId, githubToken);
  const sandboxId = await createDaytonaSandbox(repositoryId, issue.number);
  const commands = executionCommands(repositoryId, issue, patchPackage, githubToken, baseBranch);
  const commandResults: SandboxCommandResultViewModel[] = [];

  try {
    for (const command of commands) {
      commandResults.push(await runDaytonaCommand(sandboxId, command));
    }
    const failed = commandResults.find((command) => command.status === 'failed');
    const headSha = [...commandResults].reverse().find((command) => command.command === 'git rev-parse HEAD')?.summary.trim() || 'unknown';
    const attempt = buildAttempt(issue, repositoryId, sandboxId, patchPackage, commandResults, failed?.summary ?? null, 'daytona', baseBranch);
    const pullRequest = failed ? null : await createGitHubPullRequest(repositoryId, patchPackage, issue.number, headSha, baseBranch, githubToken);

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
    return { ok: false, blocked: false, error: message, patchPackage, attempt: buildAttempt(issue, repositoryId, sandboxId, patchPackage, commandResults, message, 'daytona', baseBranch), pullRequest: null };
  }
}

async function runLocalAgentExecution(issue: IssueDetailViewModel, repositoryId: string, patchPackage: AgentPatchPackage): Promise<AgentExecutionResult> {
  const githubToken = await resolveGitHubToken();
  const baseBranch = await getGitHubDefaultBranch(repositoryId, githubToken);
  const sandboxId = `local-agent-${issue.number}-${Date.now()}`;
  const commandResults: SandboxCommandResultViewModel[] = [];
  const workspace = await mkdtemp(path.join(tmpdir(), `maintaineros-agent-${issue.number}-`));
  const repoDir = path.join(workspace, 'repo');
  const patchPath = path.join(workspace, 'agent.patch');

  try {
    const [owner, repo] = repositoryId.split('/');
    const cloneUrl = `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`;
    await pushLocalResult(commandResults, runLocalFileCommand('git clone repository', 'git', ['clone', '--depth', '1', '--branch', baseBranch, cloneUrl, repoDir]));
    await pushLocalResult(commandResults, runLocalFileCommand('git config user.name MaintainerOS AI', 'git', ['config', 'user.name', 'MaintainerOS AI'], repoDir));
    await pushLocalResult(commandResults, runLocalFileCommand('git config user.email ai@maintaineros.local', 'git', ['config', 'user.email', 'ai@maintaineros.local'], repoDir));
    await pushLocalResult(commandResults, runLocalFileCommand(`git switch -c ${patchPackage.branchName}`, 'git', ['switch', '-c', patchPackage.branchName], repoDir));
    await writeFile(patchPath, patchPackage.unifiedDiff, 'utf8');
    await pushLocalResult(commandResults, runLocalFileCommand('git apply generated patch', 'git', ['apply', patchPath], repoDir));
    for (const command of patchPackage.verificationCommands) {
      await pushLocalResult(commandResults, runLocalShellCommand(`verify: ${command}`, command, repoDir));
    }
    await pushLocalResult(commandResults, runLocalFileCommand('git add changed files', 'git', ['add', '--', ...patchPackage.filesIntended], repoDir));
    await pushLocalResult(commandResults, runLocalFileCommand(`git commit -m ${patchPackage.commitMessage}`, 'git', ['commit', '-m', patchPackage.commitMessage], repoDir));
    await pushLocalResult(commandResults, runLocalFileCommand(`git push origin ${patchPackage.branchName}`, 'git', ['push', 'origin', patchPackage.branchName], repoDir));
    await pushLocalResult(commandResults, runLocalFileCommand('git rev-parse HEAD', 'git', ['rev-parse', 'HEAD'], repoDir));

    const failed = commandResults.find((command) => command.status === 'failed');
    const headSha = [...commandResults].reverse().find((command) => command.command === 'git rev-parse HEAD')?.summary.trim() || 'unknown';
    const attempt = buildAttempt(issue, repositoryId, sandboxId, patchPackage, commandResults, failed?.summary ?? null, 'local', baseBranch);
    const pullRequest = failed ? null : await createGitHubPullRequest(repositoryId, patchPackage, issue.number, headSha, baseBranch, githubToken);

    await recordProviderRun({
      provider: 'daytona',
      purpose: 'run-agent-local',
      status: failed ? 'failed' : 'succeeded',
      sourceState: 'live',
      repositoryId,
      issueNumber: issue.number,
      runId: sandboxId,
      artifactUrl: pullRequest?.htmlUrl ?? null,
      latencyMs: totalDuration(commandResults),
      errorMessage: failed?.summary ?? null,
      requestMeta: { backend: 'local', branchName: patchPackage.branchName, filesIntended: patchPackage.filesIntended },
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
    const message = error instanceof Error ? error.message : 'Unknown local agent execution error.';
    const attempt = buildAttempt(issue, repositoryId, sandboxId, patchPackage, commandResults, message, 'local', baseBranch);
    await recordProviderRun({
      provider: 'daytona',
      purpose: 'run-agent-local',
      status: 'failed',
      sourceState: 'live',
      repositoryId,
      issueNumber: issue.number,
      runId: sandboxId,
      errorMessage: message,
      responseMeta: { backend: 'local', commandResults, patchSummary: patchPackage.summary },
    });
    return { ok: false, blocked: false, error: message, patchPackage, attempt, pullRequest: null };
  } finally {
    if (process.env.MAINTAINEROS_KEEP_AGENT_WORKTREE !== 'true') {
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export async function generateClodPatchPackage(issue: IssueDetailViewModel, repositoryId: string): Promise<AgentPatchPackage> {
  if (!process.env.CLOD_API_KEY) throw new Error('CLOD_API_KEY is required to generate an agent patch.');
  const baseUrl = (process.env.CLOD_BASE_URL || 'https://api.clod.io/v1').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLOD_BALANCED_MODEL || process.env.CLOD_CHEAP_MODEL || 'DeepSeek V3',
      max_completion_tokens: 1800,
      messages: [
        {
          role: 'system',
          content: 'Return strict JSON only with summary, branchName, commitMessage, filesIntended, unifiedDiff, and verificationCommands. unifiedDiff must be a git apply compatible patch.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            repositoryId,
            issue: { number: issue.number, title: issue.title, body: issue.body, labels: issue.labels },
            workOrder: issue.workOrder,
            contextPack: issue.contextPack,
          }),
        },
      ],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `CLŌD patch request failed with ${response.status}.`);
  return parseAgentPatchPackage(payload?.choices?.[0]?.message?.content);
}

function executionCommands(repositoryId: string, issue: IssueDetailViewModel, patchPackage: AgentPatchPackage, token: string, baseBranch: string) {
  const [owner, repo] = repositoryId.split('/');
  const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  return [
    `rm -rf /tmp/maintaineros-agent-${issue.number}`,
    `git clone --depth 1 --branch ${shellQuote(baseBranch)} ${shellQuote(cloneUrl)} /tmp/maintaineros-agent-${issue.number}`,
    `cd /tmp/maintaineros-agent-${issue.number} && git switch -c ${shellQuote(patchPackage.branchName)}`,
    `cd /tmp/maintaineros-agent-${issue.number} && cat > /tmp/maintaineros-agent-${issue.number}.patch <<'PATCH'\n${patchPackage.unifiedDiff}\nPATCH\n git apply /tmp/maintaineros-agent-${issue.number}.patch`,
    ...patchPackage.verificationCommands.map((command) => `cd /tmp/maintaineros-agent-${issue.number} && ${command}`),
    `cd /tmp/maintaineros-agent-${issue.number} && git add ${patchPackage.filesIntended.map(shellQuote).join(' ')} && git commit -m ${shellQuote(patchPackage.commitMessage)}`,
    `cd /tmp/maintaineros-agent-${issue.number} && git push origin ${shellQuote(patchPackage.branchName)}`,
    `cd /tmp/maintaineros-agent-${issue.number} && git rev-parse HEAD`,
  ];
}

async function createDaytonaSandbox(repositoryId: string, issueNumber: number) {
  if (!process.env.DAYTONA_API_KEY) throw new Error('DAYTONA_API_KEY is required to create an agent sandbox.');
  const baseUrl = (process.env.DAYTONA_API_URL || process.env.DAYTONA_BASE_URL || 'https://app.daytona.io/api').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/sandboxes`, {
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
    command: sanitizeCommand(command),
    status: response.ok && exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    durationMs: Date.now() - startedAt,
    summary: String(output).slice(0, 500),
  };
}

async function createGitHubPullRequest(repositoryId: string, patchPackage: AgentPatchPackage, issueNumber: number, headSha: string, baseBranch: string, githubToken: string): Promise<PullRequestViewModel> {
  const [owner, repo] = repositoryId.split('/');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'MaintainerOS-agent',
    },
    body: JSON.stringify({
      title: patchPackage.commitMessage,
      head: patchPackage.branchName,
      base: baseBranch,
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
  backend: 'daytona' | 'local' = 'daytona',
  baseBranch = process.env.GITHUB_DEFAULT_BRANCH || 'main',
): SandboxExecutionViewModel {
  const completedCommands = commandResults.filter((command) => command.status === 'passed').map((command) => command.command);
  return {
    provider: 'daytona',
    sourceState: 'live',
    id: `daytona-${repositoryId}-${issue.number}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    status: failureReason ? 'failed' : 'passed',
    sandboxId,
    imageOrTemplate: backend === 'local' ? 'local-worktree' : process.env.DAYTONA_TARGET || 'daytonaio/sandbox:0.6.0',
    repoRef: `${repositoryId}@${baseBranch}`,
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

async function runLocalFileCommand(command: string, file: string, args: string[], cwd?: string): Promise<SandboxCommandResultViewModel> {
  const startedAt = Date.now();
  try {
    const result = await execFileAsync(file, args, {
      cwd,
      timeout: Number(process.env.MAINTAINEROS_AGENT_COMMAND_TIMEOUT_MS || '120000'),
      maxBuffer: Number(process.env.MAINTAINEROS_AGENT_MAX_BUFFER || '1048576'),
    });
    return {
      command,
      status: 'passed',
      exitCode: 0,
      durationMs: Date.now() - startedAt,
      summary: summarizeCommandOutput(result.stdout, result.stderr),
    };
  } catch (error) {
    return {
      command,
      status: 'failed',
      exitCode: exitCode(error),
      durationMs: Date.now() - startedAt,
      summary: summarizeCommandOutput(errorOutput(error, 'stdout'), errorOutput(error, 'stderr')) || (error instanceof Error ? error.message : 'Command failed.'),
    };
  }
}

async function runLocalShellCommand(command: string, rawCommand: string, cwd: string): Promise<SandboxCommandResultViewModel> {
  const startedAt = Date.now();
  try {
    const result = await execAsync(rawCommand, {
      cwd,
      timeout: Number(process.env.MAINTAINEROS_AGENT_COMMAND_TIMEOUT_MS || '120000'),
      maxBuffer: Number(process.env.MAINTAINEROS_AGENT_MAX_BUFFER || '1048576'),
    });
    return {
      command,
      status: 'passed',
      exitCode: 0,
      durationMs: Date.now() - startedAt,
      summary: summarizeCommandOutput(result.stdout, result.stderr),
    };
  } catch (error) {
    return {
      command,
      status: 'failed',
      exitCode: exitCode(error),
      durationMs: Date.now() - startedAt,
      summary: summarizeCommandOutput(errorOutput(error, 'stdout'), errorOutput(error, 'stderr')) || (error instanceof Error ? error.message : 'Command failed.'),
    };
  }
}

async function resolveGitHubToken() {
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return envToken;
  if (resolveAgentExecutionBackend() !== 'local') throw new Error('GITHUB_TOKEN is required for agent branch push and PR creation.');
  try {
    const result = await execFileAsync('gh', ['auth', 'token'], { timeout: 5000, maxBuffer: 2048 });
    const token = result.stdout.trim();
    if (token) return token;
  } catch {
    // Fall through to the actionable error below.
  }
  throw new Error('GITHUB_TOKEN or an authenticated GitHub CLI (`gh auth login`) is required for local AI PR creation.');
}

async function getGitHubDefaultBranch(repositoryId: string, githubToken: string) {
  const [owner, repo] = repositoryId.split('/');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'MaintainerOS-agent',
    },
  });
  const payload = await response.json().catch(() => ({})) as { default_branch?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || `GitHub repository lookup failed with ${response.status}.`);
  return payload.default_branch || process.env.GITHUB_DEFAULT_BRANCH || 'main';
}

function resolveAgentExecutionBackend(): 'daytona' | 'local' {
  const configured = process.env.MAINTAINEROS_AGENT_EXECUTION_MODE?.toLowerCase();
  if (configured === 'local') return 'local';
  if (configured === 'daytona') return 'daytona';
  return process.env.DAYTONA_API_KEY ? 'daytona' : 'local';
}

function summarizeCommandOutput(stdout?: string, stderr?: string) {
  return [stdout, stderr].filter(Boolean).join('\n').trim().slice(0, 500);
}

async function pushLocalResult(commandResults: SandboxCommandResultViewModel[], resultPromise: Promise<SandboxCommandResultViewModel>) {
  const result = await resultPromise;
  commandResults.push(result);
  if (result.status === 'failed') {
    throw new Error(result.summary || `${result.command} failed.`);
  }
}

function errorOutput(error: unknown, key: 'stdout' | 'stderr') {
  if (error && typeof error === 'object' && key in error) {
    const value = (error as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function exitCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'number' ? code : 1;
  }
  return 1;
}

function sanitizeCommand(command: string) {
  return command
    .replace(/https:\/\/x-access-token:[^@'\s]+@github\.com/g, 'https://x-access-token:<redacted>@github.com')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer <redacted>');
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

function assertRepositoryId(repositoryId: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryId)) {
    throw new Error('repositoryId must be formatted as owner/repo.');
  }
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
