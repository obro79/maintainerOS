import { equal, ok, throws } from 'node:assert/strict';
import { redactAgentCommandForEvidence } from '../lib/maintaineros/agent-command-evidence';
import { parseAgentPatchPackage } from '../lib/maintaineros/agent-patch-package';

const patch = parseAgentPatchPackage(JSON.stringify({
  summary: 'Normalize labels before routing.',
  branchName: 'maintaineros/issue-1-normalize-labels',
  commitMessage: 'Normalize issue labels before routing',
  filesIntended: ['src/router.js', 'src/router.test.js'],
  unifiedDiff: 'diff --git a/src/router.js b/src/router.js\n--- a/src/router.js\n+++ b/src/router.js\n@@ -1 +1 @@\n-old\n+new\n',
  verificationCommands: ['npm test', 'npm run lint'],
}));

equal(patch.branchName, 'maintaineros/issue-1-normalize-labels');
equal(patch.verificationCommands.length, 2);
ok(patch.unifiedDiff.includes('diff --git'));

const fencedPatch = parseAgentPatchPackage(`Here is the patch package:

\`\`\`json
${JSON.stringify({
  summary: 'Document OAuth setup.',
  branchName: 'maintaineros/issue-9-oauth-docs',
  commitMessage: 'Document OAuth callback setup',
  filesIntended: ['docs/oauth.md'],
  unifiedDiff: 'diff --git a/docs/oauth.md b/docs/oauth.md\n--- a/docs/oauth.md\n+++ b/docs/oauth.md\n@@ -1 +1 @@\n-old\n+new\n',
  verificationCommands: ['npm run lint'],
})}
\`\`\``);

equal(fencedPatch.branchName, 'maintaineros/issue-9-oauth-docs');
equal(fencedPatch.filesIntended[0], 'docs/oauth.md');

throws(
  () => parseAgentPatchPackage(JSON.stringify({
    summary: 'Bad package',
    branchName: 'bad branch',
    commitMessage: 'bad',
    filesIntended: ['src/router.js'],
    unifiedDiff: 'diff --git a/src/router.js b/src/router.js\n',
    verificationCommands: ['npm test'],
  })),
  /invalid branch name/,
);

throws(
  () => parseAgentPatchPackage(JSON.stringify({
    summary: 'Bad package',
    branchName: 'maintaineros/issue-1',
    commitMessage: 'bad',
    filesIntended: ['src/router.js'],
    unifiedDiff: 'not a patch',
    verificationCommands: ['npm test'],
  })),
  /missing git unified diff/,
);

const redactedClone = redactAgentCommandForEvidence("git clone 'https://x-access-token:gho_secret123@github.com/owner/repo.git' /tmp/repo");
ok(!redactedClone.includes('gho_secret123'));
ok(redactedClone.includes('x-access-token:[redacted]@github.com'));

const redactedBearer = redactAgentCommandForEvidence('Authorization: Bearer ghp_secret456');
ok(!redactedBearer.includes('ghp_secret456'));
ok(redactedBearer.includes('Bearer [redacted]'));

console.log('MaintainerOS agent execution smoke passed.');
