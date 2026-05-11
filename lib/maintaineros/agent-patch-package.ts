export interface AgentPatchPackage {
  summary: string;
  branchName: string;
  commitMessage: string;
  filesIntended: string[];
  unifiedDiff: string;
  verificationCommands: string[];
  fileEdits: AgentFileEdit[];
}

export interface AgentFileEdit {
  path: string;
  content: string;
}

export function parseAgentPatchPackage(content: unknown): AgentPatchPackage {
  if (typeof content !== 'string') throw new Error('CLŌD patch response did not include message content.');

  let parsed: Partial<AgentPatchPackage>;
  try {
    parsed = JSON.parse(extractJsonObject(content)) as Partial<AgentPatchPackage>;
  } catch {
    throw new Error('CLŌD patch response was not valid JSON.');
  }

  const summary = stringValue(parsed.summary);
  const branchName = stringValue(parsed.branchName).replace(/^refs\/heads\//, '');
  const commitMessage = stringValue(parsed.commitMessage);
  const unifiedDiff = normalizeUnifiedDiff(stringValue(parsed.unifiedDiff));
  const fileEdits = parseFileEdits(parsed);

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
    fileEdits,
  };
}

function parseFileEdits(parsed: Partial<AgentPatchPackage> & { fileEdits?: unknown }): AgentFileEdit[] {
  if (!Array.isArray(parsed.fileEdits)) return [];
  return parsed.fileEdits
    .map((edit) => {
      if (!edit || typeof edit !== 'object') return null;
      const value = edit as { path?: unknown; content?: unknown };
      const path = stringValue(value.path);
      const content = typeof value.content === 'string' ? value.content : '';
      if (!isSafeRelativePath(path)) return null;
      return { path, content };
    })
    .filter((edit): edit is AgentFileEdit => Boolean(edit))
    .slice(0, 10);
}

function isSafeRelativePath(path: string) {
  return Boolean(path) && !path.startsWith('/') && !path.split('/').includes('..') && !path.includes('\0');
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) return fenced;
  if (trimmed.startsWith('{')) return trimmed;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function normalizeUnifiedDiff(diff: string) {
  return diff.replace(
    /(^diff --git a\/(.+) b\/\2\n(?:new file mode .+\n)?index 0000000\.\.[^\n]+\n)--- a\/\2\n\+\+\+ b\/\2/gm,
    '$1--- /dev/null\n+++ b/$2',
  );
}
