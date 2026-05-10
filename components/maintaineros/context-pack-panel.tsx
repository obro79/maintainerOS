import { EvidenceBadge } from './evidence-badge';
import type { ContextPackViewModel } from '@/lib/maintaineros/types';

export function ContextPackPanel({ contextPack }: { contextPack: ContextPackViewModel | null }) {
  if (!contextPack) {
    return (
      <p className="text-sm text-zinc-300">
        No context pack is attached because this issue route does not need repo-grounding context yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-300">{contextPack.summary}</p>
          {contextPack.query && <p className="mt-1 text-xs text-zinc-600">Query: {contextPack.query}</p>}
        </div>
        <EvidenceBadge sourceState={contextPack.sourceState} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-500">
        <span>Status: {contextPack.status}</span>
        <span>Sources: {contextPack.sourceCount}</span>
        <span>Confidence: {Math.round(contextPack.confidence * 100)}%</span>
      </div>
      {contextPack.errorMessage && <p className="mt-2 text-xs text-amber-300">{contextPack.errorMessage}</p>}
      {(contextPack.providerRunId || contextPack.artifactUrl) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {contextPack.providerRunId && (
            <span className="rounded-full border border-white/8 px-2 py-1 font-mono text-zinc-600">{contextPack.providerRunId}</span>
          )}
          {contextPack.artifactUrl && <a className="text-blue-300 hover:text-blue-200" href={contextPack.artifactUrl}>Context artifact</a>}
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-700">Top citations</p>
          <div className="mt-2 space-y-2">
            {contextPack.citations.slice(0, 4).map((citation) => (
              <div key={citation.id} className="rounded-lg border border-white/6 p-2">
                <div className="flex items-center justify-between gap-2">
                  {citation.sourceUrl ? (
                    <a className="truncate text-xs font-medium text-blue-300 hover:text-blue-200" href={citation.sourceUrl}>
                      {citation.title}
                    </a>
                  ) : (
                    <p className="truncate text-xs font-medium text-zinc-300">{citation.title}</p>
                  )}
                  <span className="text-[10px] uppercase text-zinc-600">{citation.kind}</span>
                </div>
                {citation.pathOrUrl && <p className="mt-1 truncate text-[10px] text-zinc-600">{citation.pathOrUrl}</p>}
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{citation.snippet}</p>
              </div>
            ))}
            {contextPack.citations.length === 0 && <p className="text-xs text-zinc-600">No citations returned.</p>}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-700">Suggested commands</p>
          <div className="mt-2 space-y-2">
            {contextPack.suggestedCommands.map((command) => (
              <code key={command} className="block rounded-lg border border-white/6 bg-white/[0.02] px-2 py-1.5 text-xs text-zinc-400">
                {command}
              </code>
            ))}
            {contextPack.suggestedCommands.length === 0 && <p className="text-xs text-zinc-600">No commands suggested.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
