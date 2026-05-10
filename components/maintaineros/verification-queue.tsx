import Link from 'next/link';
import { EvidenceBadge } from './evidence-badge';
import type { VerificationQueueItemViewModel } from '@/lib/maintaineros/types';

export function VerificationQueue({ items }: { items: VerificationQueueItemViewModel[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-[#080d14] p-6">
        <p className="text-sm font-semibold text-white">No verification work yet</p>
        <p className="mt-2 text-sm text-zinc-500">Linked PRs and Greptile proof bundles appear here when work reaches verification.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#080d14]">
      <div className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_0.6fr] gap-3 border-b border-white/6 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-700">
        <span>Issue</span>
        <span>PR</span>
        <span>Proof</span>
        <span>Blocker</span>
        <span className="text-right">Links</span>
      </div>
      <div className="divide-y divide-white/5">
        {items.map((item) => (
          <div key={`${item.issueNumber}-${item.verification.status}`} className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_0.6fr] gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-600">#{item.issueNumber}</span>
                <EvidenceBadge sourceState={item.verification.sourceState ?? 'planned'} />
              </div>
              <p className="mt-1 truncate text-sm text-zinc-200">{item.issueTitle}</p>
              <p className="mt-1 text-xs text-zinc-600">{item.route}</p>
            </div>
            <div className="min-w-0 text-xs text-zinc-500">
              {item.pullRequest ? (
                <>
                  <a className="text-blue-300" href={item.pullRequest.htmlUrl}>#{item.pullRequest.number}</a>
                  <p className="mt-1 truncate">{item.pullRequest.headSha}</p>
                  <p className="mt-1">{item.pullRequest.status}</p>
                </>
              ) : (
                <p>No PR linked</p>
              )}
            </div>
            <div className="min-w-0 text-xs text-zinc-500">
              <p className="text-zinc-300">{item.verification.status}</p>
              <p className="mt-1 truncate">{item.verification.summary}</p>
              <p className="mt-1">Findings: {item.verification.blockingFindingsCount}</p>
              <p className="mt-1 truncate">Verified: {item.verification.verifiedSha ?? 'pending'}</p>
              <p className="mt-1 truncate">Current: {item.verification.currentSha ?? item.pullRequest?.headSha ?? 'unknown'}</p>
            </div>
            <p className="text-xs text-zinc-500">{item.blockingReason}</p>
            <div className="flex justify-end gap-2 text-xs">
              <Link className="text-zinc-400 hover:text-white" href={item.detailUrl}>Detail</Link>
              <Link className="text-zinc-400 hover:text-white" href={item.traceUrl}>Trace</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
