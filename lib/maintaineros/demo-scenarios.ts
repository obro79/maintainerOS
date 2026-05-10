import type { DemoResetScenarioViewModel } from './types';

export const DEMO_SCENARIO_COOKIE = 'maintaineros_demo_scenario';
export const DEMO_SESSION_COOKIE = 'maintaineros_demo_session';
export const DEFAULT_DEMO_SCENARIO_ID: DemoResetScenarioViewModel['id'] = 'happy-path';

export const DEMO_SCENARIOS: DemoResetScenarioViewModel[] = [
  {
    id: 'happy-path',
    label: 'Happy path',
    sourceState: 'rehearsal',
    description: 'Import, route, verify, and release without interruption.',
    repositoryId: 'maintaineros-demo-large',
    targetIssueNumber: 17,
    expectedRoute: 'agent-solvable',
    traceAnchors: ['issue-17-clod', 'issue-17-verification'],
  },
  {
    id: 'failed-cheap-attempt',
    label: 'Failed cheap attempt',
    sourceState: 'rehearsal',
    description: 'Show failed low-cost execution and escalation.',
    repositoryId: 'maintaineros-demo-large',
    targetIssueNumber: 41,
    expectedRoute: 'agent-solvable',
    traceAnchors: ['issue-41-cheap-attempt', 'issue-41-escalated', 'issue-41-attempt-2-completed'],
  },
  {
    id: 'stale-verification',
    label: 'Stale verification',
    sourceState: 'rehearsal',
    description: 'Show PR changed after verification and payout blocked.',
    repositoryId: 'maintaineros-demo-large',
    targetIssueNumber: 41,
    expectedRoute: 'agent-solvable',
    traceAnchors: ['issue-41-verification', 'issue-41-verification-escalated'],
  },
  {
    id: 'bounty-release-blocked',
    label: 'Bounty blocked',
    sourceState: 'rehearsal',
    description: 'Show Clustly release blocked before maintainer acceptance.',
    repositoryId: 'maintaineros-demo-large',
    targetIssueNumber: 7,
    expectedRoute: 'bounty-worthy',
    traceAnchors: ['issue-7-clustly-posted', 'issue-7-payout-gate'],
  },
  {
    id: 'bounty-released',
    label: 'Bounty released',
    sourceState: 'rehearsal',
    description: 'Show verified work released through Clustly.',
    repositoryId: 'maintaineros-demo-large',
    targetIssueNumber: 15,
    expectedRoute: 'bounty-worthy',
    traceAnchors: ['issue-15-clustly-funded', 'issue-15-payment'],
  },
];

export function getDemoScenario(id?: string | null) {
  return DEMO_SCENARIOS.find((scenario) => scenario.id === id) ?? DEMO_SCENARIOS.find((scenario) => scenario.id === DEFAULT_DEMO_SCENARIO_ID)!;
}

export function isDemoScenarioId(id: string): id is DemoResetScenarioViewModel['id'] {
  return DEMO_SCENARIOS.some((scenario) => scenario.id === id);
}

export function createDemoSessionId() {
  return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
