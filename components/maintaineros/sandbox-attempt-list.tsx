import Link from 'next/link';
import { EvidenceBadge } from './evidence-badge';
import type { SandboxAttemptListItemViewModel } from '@/lib/maintaineros/types';

export function SandboxAttemptList({ attempts }: { attempts: SandboxAttemptListItemViewModel[] }) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-[#080d14] p-6">
        <p className="text-sm font-semibold text-white">No sandbox attempts yet</p>
        <p className="mt-2 text-sm text-zinc-500">Agent and bounty routes will appear here after a Daytona-style sandbox attempt is recorded.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#080d14]">
      <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.7fr] gap-3 border-b border-white/6 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-700">
        <span>Issue</span>
        <span>Sandbox</span>
        <span>Commands</span>
        <span>Artifacts</span>
        <span className="text-right">Links</span>
      </div>
      <div className="divide-y divide-white/5">
        {attempts.map(({ attempt, issueNumber, issueTitle, route, traceUrl, detailUrl }) => (
          <div key={attempt.id} className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.7fr] gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-600">#{issueNumber}</span>
                <EvidenceBadge sourceState={attempt.sourceState} />
              </div>
              <p className="mt-1 truncate text-sm text-zinc-200">{issueTitle}</p>
              <p className="mt-1 text-xs text-zinc-600">{route} · {attempt.status}</p>
            </div>
            <div className="min-w-0 text-xs text-zinc-500">
              <p className="truncate text-zinc-300">{attempt.sandboxId}</p>
              <p className="mt-1 truncate">{attempt.imageOrTemplate}</p>
              <p className="mt-1 truncate">{attempt.repoRef}</p>
              <p className="mt-1 truncate">{attempt.branchName}</p>
            </div>
            <div className="text-xs text-zinc-500">
              <p>{attempt.completedCommands.length}/{attempt.requestedCommands.length} completed</p>
              <p className="mt-1">Exit: {attempt.exitCode ?? 'pending'}</p>
              <p className="mt-1">{attempt.durationMs == null ? 'Duration pending' : `${Math.round(attempt.durationMs / 1000)}s`}</p>
              <p className="mt-1 truncate">Context: {attempt.contextPackId ?? 'none'}</p>
            </div>
            <div className="min-w-0 text-xs text-zinc-500">
              <p className="truncate">Files: {attempt.filesTouched.join(', ') || 'none'}</p>
              {attempt.failureReason && <p className="mt-1 text-red-300">{attempt.failureReason}</p>}
              {attempt.pullRequestUrl && <a className="mt-1 inline-flex text-blue-300" href={attempt.pullRequestUrl}>PR artifact</a>}
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <Link className="text-zinc-400 hover:text-white" href={detailUrl}>Detail</Link>
              <Link className="text-zinc-400 hover:text-white" href={traceUrl}>Trace</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
