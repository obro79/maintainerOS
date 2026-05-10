import { EvidenceBadge } from './evidence-badge';
import type { ContextPackViewModel } from '@/lib/maintaineros/types';

export function ContextPackPanel({ contextPack }: { contextPack: ContextPackViewModel | null }) {
  if (!contextPack) {
    return (
      <p className="text-sm text-[#F9F7F7]/76">
        No context pack is attached because this issue route does not need repo-grounding context yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#F9F7F7]/76">{contextPack.summary}</p>
          {contextPack.query && <p className="mt-1 text-xs text-[#F9F7F7]/40">Query: {contextPack.query}</p>}
        </div>
        <EvidenceBadge sourceState={contextPack.sourceState} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[#F9F7F7]/56">
        <span>Status: {contextPack.status}</span>
        <span>Sources: {contextPack.sourceCount}</span>
        <span>Confidence: {Math.round(contextPack.confidence * 100)}%</span>
      </div>
      {contextPack.errorMessage && <p className="mt-2 text-xs text-[#DBE2EF]">{contextPack.errorMessage}</p>}
      {(contextPack.providerRunId || contextPack.artifactUrl) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {contextPack.providerRunId && (
            <span className="rounded-full border border-[#F9F7F7]/12 px-2 py-1 font-sans text-[#F9F7F7]/40">{contextPack.providerRunId}</span>
          )}
          {contextPack.artifactUrl && <a className="text-[#DBE2EF] hover:text-[#DBE2EF]" href={contextPack.artifactUrl}>Context artifact</a>}
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Top citations</p>
          <div className="mt-2 space-y-2">
            {contextPack.citations.slice(0, 4).map((citation) => (
              <div key={citation.id} className="rounded-lg border border-[#F9F7F7]/10 p-2">
                <div className="flex items-center justify-between gap-2">
                  {citation.sourceUrl ? (
                    <a className="truncate text-xs font-medium text-[#DBE2EF] hover:text-[#DBE2EF]" href={citation.sourceUrl}>
                      {citation.title}
                    </a>
                  ) : (
                    <p className="truncate text-xs font-medium text-[#F9F7F7]/76">{citation.title}</p>
                  )}
                  <span className="text-[10px] uppercase text-[#F9F7F7]/40">{citation.kind}</span>
                </div>
                {citation.pathOrUrl && <p className="mt-1 truncate text-[10px] text-[#F9F7F7]/40">{citation.pathOrUrl}</p>}
                <p className="mt-1 text-xs leading-relaxed text-[#F9F7F7]/56">{citation.snippet}</p>
              </div>
            ))}
            {contextPack.citations.length === 0 && <p className="text-xs text-[#F9F7F7]/40">No citations returned.</p>}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Suggested commands</p>
          <div className="mt-2 space-y-2">
            {contextPack.suggestedCommands.map((command) => (
              <code key={command} className="block rounded-lg border border-[#F9F7F7]/10 bg-[#F9F7F7]/[0.025] px-2 py-1.5 text-xs text-[#F9F7F7]/68">
                {command}
              </code>
            ))}
            {contextPack.suggestedCommands.length === 0 && <p className="text-xs text-[#F9F7F7]/40">No commands suggested.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
