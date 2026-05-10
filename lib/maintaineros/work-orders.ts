import type { ExecutionRoute, RoutePolicyViewModel, WorkOrderViewModel } from './types';

interface WorkOrderInput {
  issueNumber: number;
  title: string;
  route: ExecutionRoute;
  routePolicy: RoutePolicyViewModel;
  suggestedFiles: string[];
  base?: WorkOrderViewModel;
}

export function buildDeterministicWorkOrder(input: WorkOrderInput): WorkOrderViewModel {
  const baseChecks = input.base?.acceptanceChecks.length ? input.base.acceptanceChecks : [
    'Reproduce or explain the issue before implementation.',
    'Keep the fix scoped to the original issue.',
    'Attach verification evidence before completion.',
  ];
  const suggestedFiles = input.suggestedFiles.length > 0 ? input.suggestedFiles : input.base?.suggestedFiles ?? [];
  const rationale = policyAwareRationale(input);

  if (input.routePolicy.executionMode === 'ai') {
    return {
      ...input.base,
      title: input.base?.title ?? `AI work order for #${input.issueNumber}`,
      summary: input.base?.summary ?? `Safe AI implementation path for ${input.title}.`,
      rationale,
      generatedBy: input.base?.generatedBy ?? 'deterministic',
      status: 'ready',
      assigneeKind: 'agent',
      acceptanceChecks: [
        ...baseChecks,
        'Run the suggested commands and keep command results attached to the sandbox artifact.',
        'Do not mark complete until fresh Greptile verification passes the current PR SHA.',
      ],
      suggestedFiles,
      suggestedCommands: input.base?.suggestedCommands ?? ['npm test', 'npm run lint'],
      automationSummary: 'AI execution allowed by deterministic route gates.',
    };
  }

  if (input.routePolicy.executionMode === 'clustly') {
    return {
      ...input.base,
      title: input.base?.title ?? `Clustly paid-work brief for #${input.issueNumber}`,
      summary: input.base?.summary ?? `Bounded contributor task for ${input.title}.`,
      rationale,
      generatedBy: input.base?.generatedBy ?? 'deterministic',
      status: 'ready',
      assigneeKind: 'contributor',
      acceptanceChecks: [
        ...baseChecks,
        'Attach a linked PR before verification or release.',
        'Keep payout release blocked until fresh Greptile verification and maintainer acceptance both exist.',
      ],
      suggestedFiles,
      suggestedCommands: input.base?.suggestedCommands ?? ['npm test', 'npm run lint'],
      automationSummary: 'Paid-work route: no autonomous AI sandbox dispatch.',
    };
  }

  if (input.routePolicy.executionMode === 'clarify') {
    return {
      ...input.base,
      title: input.base?.title ?? `Clarification brief for #${input.issueNumber}`,
      summary: input.base?.summary ?? `Clarify expected behavior before implementation for ${input.title}.`,
      rationale,
      generatedBy: input.base?.generatedBy ?? 'deterministic',
      status: 'blocked',
      assigneeKind: 'unassigned',
      acceptanceChecks: [
        'Ask for a concrete reproduction, expected behavior, and affected version.',
        'Do not start AI or paid work until the issue has enough implementation detail.',
      ],
      suggestedFiles,
      suggestedCommands: [],
      automationSummary: 'Clarification required before any execution route.',
    };
  }

  return {
    ...input.base,
    title: input.base?.title ?? `Maintainer brief for #${input.issueNumber}`,
    summary: input.base?.summary ?? `Human review required before implementation for ${input.title}.`,
    rationale,
    generatedBy: input.base?.generatedBy ?? 'deterministic',
    status: 'blocked',
    assigneeKind: 'maintainer',
    acceptanceChecks: [
      'Review the route policy reasons before dispatch.',
      'Decide whether to keep this as DEV work, rewrite scope for AI, or move it to Clustly.',
      'Require fresh Greptile verification before completion if a PR is linked.',
    ],
    suggestedFiles,
    suggestedCommands: [],
    automationSummary: 'DEV route: autonomous AI execution is blocked.',
  };
}

function policyAwareRationale(input: WorkOrderInput) {
  const policyRationale = input.routePolicy.reasons.join(' ');
  if (!input.base?.rationale) return policyRationale;
  if (input.base.rationale.includes(policyRationale)) return input.base.rationale;
  return `${input.base.rationale} ${policyRationale}`;
}
