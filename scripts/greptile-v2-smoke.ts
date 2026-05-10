import { deepEqual, equal, ok } from 'node:assert/strict';
import {
  buildGreptileHeaders,
  buildGreptileQueryRequest,
  buildGreptileRepositoryRequest,
  GREPTILE_DEFAULT_BASE_URL,
  normalizeGreptileQueryVerification,
} from '../lib/maintaineros/greptile-shape';
import type { IssueDetailViewModel, PullRequestViewModel } from '../lib/maintaineros/types';

const issue = {
  id: 'issue-8',
  number: 8,
  title: 'Dashboard routes bugs to needs-triage',
  body: 'Bug labels should route to the agent flow.',
  htmlUrl: 'https://github.com/obro79/maintainerOS/issues/8',
  workOrder: {
    acceptanceChecks: ['BUG labels route to agent-solvable.', 'Regression coverage exists.'],
    suggestedFiles: ['lib/maintaineros/routing.ts', 'scripts/routing-policy-smoke.ts'],
  },
  sandboxExecutions: [
    { filesTouched: ['lib/maintaineros/routing.ts'] },
  ],
} as IssueDetailViewModel;

const pullRequest = {
  number: 30,
  title: 'Fix routing',
  htmlUrl: 'https://github.com/obro79/maintainerOS/pull/30',
  branchName: 'of/agent-flow-routing-ui',
  headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
} as PullRequestViewModel;

equal(GREPTILE_DEFAULT_BASE_URL, 'https://api.greptile.com/v2');
deepEqual(buildGreptileRepositoryRequest('obro79/maintainerOS', pullRequest.branchName), {
  remote: 'github',
  repository: 'obro79/maintainerOS',
  branch: pullRequest.branchName,
  reload: false,
  notify: false,
});

const headers = buildGreptileHeaders('greptile-key', 'github-token') as Record<string, string>;
equal(headers.Authorization, 'Bearer greptile-key');
equal(headers['X-GitHub-Token'], 'github-token');

const query = buildGreptileQueryRequest({
  sessionId: 'session-1',
  repositoryId: 'obro79/maintainerOS',
  issue,
  pullRequest,
});
equal(query.repositories[0]?.repository, 'obro79/maintainerOS');
equal(query.repositories[0]?.branch, pullRequest.branchName);
equal(query.stream, false);
equal(query.genius, true);
ok(query.messages[0]?.content.includes('Acceptance checks'));
ok(query.messages[0]?.content.includes(pullRequest.htmlUrl));
ok(query.messages[0]?.content.includes('lib/maintaineros/routing.ts'));

const passed = normalizeGreptileQueryVerification(issue, pullRequest, {
  message: `VERDICT: passed

SUMMARY:
The branch satisfies both checks for aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.

BLOCKING FINDINGS:
None.`,
  sources: [{ filepath: 'lib/maintaineros/routing.ts' }],
});
equal(passed.status, 'passed');
equal(passed.isStale, false);
equal(passed.blockingFindingsCount, 0);
deepEqual(passed.filesInspected, ['lib/maintaineros/routing.ts']);

const stale = normalizeGreptileQueryVerification(issue, pullRequest, {
  message: `VERDICT: passed

SUMMARY:
Verified old SHA bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.`,
  sources: [],
});
equal(stale.status, 'stale');
equal(stale.isStale, true);
ok(stale.failureReason);

const failed = normalizeGreptileQueryVerification(issue, pullRequest, {
  message: `VERDICT: failed

BLOCKING FINDINGS:
- Missing regression coverage.`,
  sources: [],
});
equal(failed.status, 'failed');
equal(failed.blockingFindings?.[0], 'Missing regression coverage.');

console.log('MaintainerOS Greptile v2 smoke passed.');
