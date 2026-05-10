import type {
  ArtifactSourceState,
  IssueDetailViewModel,
  IssueTraceEventViewModel,
  SandboxAttemptListItemViewModel,
  SandboxExecutionViewModel,
} from './types';

export function buildSandboxExecutionsForIssue(issue: IssueDetailViewModel, repositoryId: string, sourceState: ArtifactSourceState): SandboxExecutionViewModel[] {
  if (!shouldAttemptSandbox(issue)) return [];

  const baseAttempt = buildAttempt(issue, repositoryId, sourceState, {
    suffix: 'attempt-1',
    status: issue.verification?.status === 'passed' ? 'passed' : 'failed',
    completedCommands: issue.verification?.status === 'passed' ? suggestedCommandsFor(issue) : [suggestedCommandsFor(issue)[0]],
    exitCode: issue.verification?.status === 'passed' ? 0 : 1,
    failureReason: issue.verification?.status === 'passed' ? null : 'Regression evidence did not satisfy the work-order acceptance checks.',
    logSummary: issue.verification?.status === 'passed'
      ? 'Sandbox executed requested commands and produced a PR artifact. Correctness still requires Greptile verification.'
      : 'Sandbox attempt failed before verification; logs and touched files remain preserved for escalation.',
  });

  if (shouldShowEscalatedRetry(issue)) {
    return [
      baseAttempt,
      buildAttempt(issue, repositoryId, sourceState, {
        suffix: 'attempt-2',
        status: 'passed',
        completedCommands: suggestedCommandsFor(issue),
        exitCode: 0,
        failureReason: null,
        logSummary: 'Escalated retry completed in sandbox and opened a PR artifact. This is execution evidence, not correctness.',
      }),
    ];
  }

  return [baseAttempt];
}

export function buildSandboxTraceEvents(issue: IssueDetailViewModel, attempts: SandboxExecutionViewModel[]): IssueTraceEventViewModel[] {
  return attempts.flatMap((attempt, index) => {
    const at = new Date(Date.UTC(2026, 4, 8, 20, issue.number % 55, index)).toISOString();
    const events: IssueTraceEventViewModel[] = [
      {
        id: `${attempt.id}-dispatched`,
        at,
        actor: 'Daytona-style sandbox',
        provider: 'daytona',
        sourceState: attempt.sourceState,
        title: `Sandbox dispatched: ${attempt.sandboxId}`,
        detail: `${attempt.imageOrTemplate} ran ${attempt.requestedCommands.length} requested command(s) on ${attempt.branchName}.`,
        status: 'running',
        relatedId: attempt.id,
      },
      {
        id: `${attempt.id}-completed`,
        at,
        actor: 'Daytona-style sandbox',
        provider: 'daytona',
        sourceState: attempt.sourceState,
        title: attempt.status === 'passed' ? 'Sandbox attempt completed' : 'Sandbox attempt failed',
        detail: attempt.status === 'passed' ? attempt.logSummary : attempt.failureReason ?? attempt.logSummary,
        status: attempt.status === 'passed' ? 'passed' : 'failed',
        artifactUrl: attempt.pullRequestUrl ?? undefined,
        relatedId: attempt.id,
        filesTouched: attempt.filesTouched,
      },
    ];

    if (attempt.status === 'failed') {
      events.push({
        id: `${attempt.id}-escalated`,
        at,
        actor: 'Escalation policy',
        sourceState: attempt.sourceState,
        title: 'Failed sandbox attempt preserved',
        detail: 'MaintainerOS keeps the failed attempt visible and routes the issue toward retry, deeper model, or maintainer/bounty review.',
        status: 'escalated',
        relatedId: attempt.id,
      });
    }

    attempt.commandResults.forEach((command, commandIndex) => {
      events.push({
        id: `${attempt.id}-command-${commandIndex + 1}`,
        at,
        actor: 'Sandbox command runner',
        provider: 'daytona',
        sourceState: attempt.sourceState,
        title: `Command ${command.status}: ${command.command}`,
        detail: command.summary,
        status: command.status === 'passed' ? 'passed' : command.status === 'failed' ? 'failed' : command.status === 'running' ? 'running' : 'pending',
        relatedId: attempt.id,
      });
    });

    return events;
  });
}

export function toSandboxAttemptListItems(repositoryId: string, issue: IssueDetailViewModel): SandboxAttemptListItemViewModel[] {
  return issue.sandboxExecutions.map((attempt) => ({
    issueNumber: issue.number,
    issueTitle: issue.title,
    route: issue.route,
    traceUrl: `/${repositoryId}/issues/${issue.number}/trace`,
    detailUrl: `/${repositoryId}/issues/${issue.number}`,
    attempt,
  }));
}

function buildAttempt(
  issue: IssueDetailViewModel,
  repositoryId: string,
  sourceState: ArtifactSourceState,
  options: {
    suffix: string;
    status: SandboxExecutionViewModel['status'];
    completedCommands: string[];
    exitCode: number;
    logSummary: string;
    failureReason: string | null;
  },
): SandboxExecutionViewModel {
  const commands = suggestedCommandsFor(issue);
  const filesTouched = issue.workOrder.suggestedFiles.length ? issue.workOrder.suggestedFiles : issue.contextPack?.citations.map((citation) => citation.pathOrUrl ?? citation.title) ?? [];
  return {
    provider: 'daytona',
    sourceState,
    id: `${issue.id}-${options.suffix}`,
    status: options.status,
    sandboxId: `daytona-${issue.number}-${options.suffix}`,
    imageOrTemplate: 'maintaineros-node-20',
    repoRef: `${repositoryId}@main`,
    branchName: `maintaineros/issue-${issue.number}-${options.suffix}`,
    contextMode: issue.contextPack?.id ? 'nia-enriched' : 'baseline',
    contextPackId: issue.contextPack?.id ?? null,
    requestedCommands: commands,
    completedCommands: options.completedCommands,
    durationMs: options.status === 'passed' ? 11 * 60 * 1000 : 4 * 60 * 1000,
    exitCode: options.exitCode,
    commandResults: commands.map((command, index) => commandResult(command, index, options)),
    logSummary: options.logSummary,
    filesTouched,
    pullRequestUrl: options.status === 'passed' ? issue.pullRequest?.htmlUrl ?? `https://github.com/${repositoryId}/pull/${900 + issue.number}` : null,
    failureReason: options.failureReason,
  };
}

function shouldAttemptSandbox(issue: IssueDetailViewModel) {
  return issue.route === 'agent-solvable' && issue.routePolicy?.automationAllowed === true && issue.routePolicy?.sandboxAllowed === true;
}

function shouldShowEscalatedRetry(issue: IssueDetailViewModel) {
  return issue.routePolicy?.automationAllowed === true && issue.number === 41;
}

function suggestedCommandsFor(issue: IssueDetailViewModel) {
  if (issue.workOrder.suggestedCommands?.length) return issue.workOrder.suggestedCommands;
  if (issue.contextPack?.suggestedCommands.length) return issue.contextPack.suggestedCommands;
  return ['npm test', 'npm run lint'];
}

function commandResult(
  command: string,
  index: number,
  options: {
    status: SandboxExecutionViewModel['status'];
    completedCommands: string[];
    exitCode: number;
    logSummary: string;
    failureReason: string | null;
  },
) {
  const completed = options.completedCommands.includes(command);
  const failedCommand = options.status === 'failed' && completed && index === options.completedCommands.length - 1;
  return {
    command,
    status: failedCommand ? 'failed' as const : completed ? 'passed' as const : 'skipped' as const,
    exitCode: failedCommand ? options.exitCode : completed ? 0 : null,
    durationMs: completed ? (failedCommand ? 75_000 : 95_000) : null,
    summary: failedCommand
      ? options.failureReason ?? options.logSummary
      : completed
        ? `Command completed during sandbox attempt: ${command}.`
        : `Command was not reached after an earlier sandbox result: ${command}.`,
  };
}
