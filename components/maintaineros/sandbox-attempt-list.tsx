import Link from 'next/link';
import { EvidenceBadge } from './evidence-badge';
import type { SandboxAttemptListItemViewModel } from '@/lib/maintaineros/types';

export function SandboxAttemptList({ attempts }: { attempts: SandboxAttemptListItemViewModel[] }) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-6">
        <p className="text-sm font-semibold text-white">No sandbox attempts yet</p>
        <p className="mt-2 text-sm text-[#F9F7F7]/56">Agent and bounty routes will appear here after a Daytona-style sandbox attempt is recorded.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]">
      <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.7fr] gap-3 border-b border-[#F9F7F7]/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#F9F7F7]/28">
        <span>Issue</span>
        <span>Sandbox</span>
        <span>Commands</span>
        <span>Artifacts</span>
        <span className="text-right">Links</span>
      </div>
      <div className="divide-y divide-[#F9F7F7]/8">
        {attempts.map(({ attempt, issueNumber, issueTitle, route, traceUrl, detailUrl }) => (
          <div key={attempt.id} className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.7fr] gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] text-[#F9F7F7]/40">#{issueNumber}</span>
                <EvidenceBadge sourceState={attempt.sourceState} />
              </div>
              <p className="mt-1 truncate text-sm text-[#F9F7F7]/88">{issueTitle}</p>
              <p className="mt-1 text-xs text-[#F9F7F7]/40">{route} · {attempt.status}</p>
            </div>
            <div className="min-w-0 text-xs text-[#F9F7F7]/56">
              <p className="truncate text-[#F9F7F7]/76">{attempt.sandboxId}</p>
              <p className="mt-1 truncate">{attempt.imageOrTemplate}</p>
              <p className="mt-1 truncate">{attempt.repoRef}</p>
              <p className="mt-1 truncate">{attempt.branchName}</p>
            </div>
            <div className="text-xs text-[#F9F7F7]/56">
              <p>{attempt.completedCommands.length}/{attempt.requestedCommands.length} completed</p>
              <p className="mt-1">Exit: {attempt.exitCode ?? 'pending'}</p>
              <p className="mt-1">{attempt.durationMs == null ? 'Duration pending' : `${Math.round(attempt.durationMs / 1000)}s`}</p>
              <p className="mt-1 truncate">Context: {attempt.contextPackId ?? 'none'}</p>
            </div>
            <div className="min-w-0 text-xs text-[#F9F7F7]/56">
              <p className="truncate">Files: {attempt.filesTouched.join(', ') || 'none'}</p>
              {attempt.failureReason && <p className="mt-1 text-[#DBE2EF]">{attempt.failureReason}</p>}
              {attempt.pullRequestUrl && <a className="mt-1 inline-flex text-[#DBE2EF]" href={attempt.pullRequestUrl}>PR artifact</a>}
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <Link className="text-[#F9F7F7]/68 hover:text-white" href={detailUrl}>Detail</Link>
              <Link className="text-[#F9F7F7]/68 hover:text-white" href={traceUrl}>Trace</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
