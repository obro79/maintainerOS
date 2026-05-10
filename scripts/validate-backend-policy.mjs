import { readFileSync } from 'node:fs';

const files = {
  routing: readFileSync('lib/maintaineros/routing.ts', 'utf8'),
  types: readFileSync('lib/maintaineros/types.ts', 'utf8'),
  workOrders: readFileSync('lib/maintaineros/work-orders.ts', 'utf8'),
  daytona: readFileSync('lib/maintaineros/daytona.ts', 'utf8'),
  verification: readFileSync('lib/maintaineros/verification.ts', 'utf8'),
  payout: readFileSync('lib/maintaineros/payout.ts', 'utf8'),
};

assertIncludes(files.routing, 'evaluateRoutePolicy', 'routing exports the central route policy evaluator');
assertIncludes(files.routing, 'AI_CONFIDENCE_THRESHOLD', 'AI routing has a confidence gate');
assertIncludes(files.routing, 'HARD_BLOCK_LABELS', 'AI routing has hard-block labels');
assertIncludes(files.routing, "route = 'maintainer-review'", 'unsafe AI candidates reroute to DEV/maintainer review');

assertIncludes(files.workOrders, 'buildDeterministicWorkOrder', 'deterministic work-order builder exists');
assertIncludes(files.workOrders, 'AI execution allowed', 'AI-safe work orders expose executable automation path');
assertIncludes(files.workOrders, 'DEV route: autonomous AI execution is blocked.', 'DEV briefs block autonomous AI execution');
assertIncludes(files.workOrders, 'Paid-work route: no autonomous AI sandbox dispatch.', 'CLUSTLY briefs block autonomous AI execution');

assertIncludes(files.types, 'commandResults: SandboxCommandResultViewModel[]', 'sandbox attempts carry command results');
assertIncludes(files.daytona, 'commandResults:', 'sandbox builder populates command results');
assertIncludes(files.daytona, 'routePolicy?.sandboxAllowed', 'sandbox dispatch uses route policy gate');
assertIncludes(files.daytona, 'Sandbox command runner', 'sandbox command results generate trace events');

assertIncludes(files.verification, 'verification.verifiedSha !== verification.currentSha', 'stale verification compares exact SHA mismatch');
assertIncludes(files.verification, "verification.status === 'stale'", 'explicit stale verification status remains blocking');
assertIncludes(files.verification, "effectiveStatus = isStale ? 'stale' : status", 'stale verification forces stale effective status');
assertIncludes(files.payout, 'isVerificationStale(issue.verification)', 'payout gate blocks stale verification');

console.log('MaintainerOS backend policy check passed.');

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Backend policy check failed: ${label}`);
  }
}
