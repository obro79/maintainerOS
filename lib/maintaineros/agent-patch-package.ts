export interface AgentPatchPackage {
  summary: string;
  branchName: string;
  commitMessage: string;
  filesIntended: string[];
  unifiedDiff: string;
  verificationCommands: string[];
}

export function parseAgentPatchPackage(content: unknown): AgentPatchPackage {
  if (typeof content !== 'string') throw new Error('CLŌD patch response did not include message content.');

  let parsed: Partial<AgentPatchPackage>;
  try {
    parsed = JSON.parse(content) as Partial<AgentPatchPackage>;
  } catch {
    throw new Error('CLŌD patch response was not valid JSON.');
  }

  const summary = stringValue(parsed.summary);
  const branchName = stringValue(parsed.branchName).replace(/^refs\/heads\//, '');
  const commitMessage = stringValue(parsed.commitMessage);
  const unifiedDiff = stringValue(parsed.unifiedDiff);

  if (!summary) throw new Error('Patch package missing summary.');
  if (!branchName || !/^[-a-zA-Z0-9/_]+$/.test(branchName)) throw new Error('Patch package has an invalid branch name.');
  if (!commitMessage) throw new Error('Patch package missing commitMessage.');
  if (!unifiedDiff || !unifiedDiff.includes('diff --git')) throw new Error('Patch package missing git unified diff.');
  if (!Array.isArray(parsed.filesIntended) || parsed.filesIntended.length === 0) throw new Error('Patch package missing filesIntended.');

  return {
    summary,
    branchName,
    commitMessage,
    filesIntended: parsed.filesIntended.map(String).slice(0, 20),
    unifiedDiff,
    verificationCommands: Array.isArray(parsed.verificationCommands) && parsed.verificationCommands.length > 0
      ? parsed.verificationCommands.map(String).slice(0, 8)
      : ['npm test', 'npm run lint'],
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}
