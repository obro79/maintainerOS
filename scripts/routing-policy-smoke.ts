import { equal } from 'node:assert/strict';
import { scoreIssue } from '../lib/maintaineros/routing';

equal(
  scoreIssue({
    title: 'Dashboard routes bugs to needs-triage when labels include uppercase BUG',
    body: 'Acceptance: add tests for BUG, Bug, and bug and keep security labels human-reviewed.',
    labels: ['BUG', 'backend', 'agent-solvable'],
  }).route,
  'agent-solvable',
);

equal(
  scoreIssue({
    title: 'Document GitHub OAuth callback URL setup for Vercel',
    labels: ['documentation', 'agent-solvable'],
  }).route,
  'agent-solvable',
);

equal(
  scoreIssue({
    title: 'OAuth callback should reject unknown redirect destinations',
    labels: ['security', 'backend', 'maintainer-review'],
  }).route,
  'maintainer-review',
);

equal(
  scoreIssue({
    title: 'Private repository support should use GitHub App installation',
    labels: ['enhancement', 'decision-needed', 'maintainer-review'],
  }).route,
  'maintainer-review',
);

console.log('MaintainerOS routing policy smoke passed.');
