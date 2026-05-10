import Link from 'next/link';
import { EvidenceBadge } from './evidence-badge';
import type { VerificationQueueItemViewModel } from '@/lib/maintaineros/types';

export function VerificationQueue({ items }: { items: VerificationQueueItemViewModel[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-6">
        <p className="text-sm font-semibold text-white">No verification work yet</p>
        <p className="mt-2 text-sm text-[#F9F7F7]/56">Linked PRs and Greptile proof bundles appear here when work reaches verification.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]">
      <div className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_0.6fr] gap-3 border-b border-[#F9F7F7]/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#F9F7F7]/28">
        <span>Issue</span>
        <span>PR</span>
        <span>Proof</span>
        <span>Blocker</span>
        <span className="text-right">Links</span>
      </div>
      <div className="divide-y divide-[#F9F7F7]/8">
        {items.map((item) => (
          <div key={`${item.issueNumber}-${item.verification.status}`} className="grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_0.6fr] gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] text-[#F9F7F7]/40">#{item.issueNumber}</span>
                <EvidenceBadge sourceState={item.verification.sourceState ?? 'planned'} />
              </div>
              <p className="mt-1 truncate text-sm text-[#F9F7F7]/88">{item.issueTitle}</p>
              <p className="mt-1 text-xs text-[#F9F7F7]/40">{item.route}</p>
            </div>
            <div className="min-w-0 text-xs text-[#F9F7F7]/56">
              {item.pullRequest ? (
                <>
                  <a className="text-[#DBE2EF]" href={item.pullRequest.htmlUrl}>#{item.pullRequest.number}</a>
                  <p className="mt-1 truncate">{item.pullRequest.headSha}</p>
                  <p className="mt-1">{item.pullRequest.status}</p>
                </>
              ) : (
                <p>No PR linked</p>
              )}
            </div>
            <div className="min-w-0 text-xs text-[#F9F7F7]/56">
              <p className="text-[#F9F7F7]/76">{item.verification.status}</p>
              <p className="mt-1 truncate">{item.verification.summary}</p>
              <p className="mt-1">Findings: {item.verification.blockingFindingsCount}</p>
              <p className="mt-1 truncate">Verified: {item.verification.verifiedSha ?? 'pending'}</p>
              <p className="mt-1 truncate">Current: {item.verification.currentSha ?? item.pullRequest?.headSha ?? 'unknown'}</p>
            </div>
            <p className="text-xs text-[#F9F7F7]/56">{item.blockingReason}</p>
            <div className="flex justify-end gap-2 text-xs">
              <Link className="text-[#F9F7F7]/68 hover:text-white" href={item.detailUrl}>Detail</Link>
              <Link className="text-[#F9F7F7]/68 hover:text-white" href={item.traceUrl}>Trace</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
