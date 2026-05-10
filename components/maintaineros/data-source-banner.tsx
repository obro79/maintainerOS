import type { MaintainerRepositorySummary } from '@/lib/maintaineros/types';
import { formatUtcDateTime } from '@/lib/maintaineros/format';
import { cn } from '@/lib/utils';

const MODE_STYLES = {
  live: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-300',
  rehearsal: 'border-sky-500/25 bg-sky-500/8 text-sky-300',
  fixture: 'border-amber-500/25 bg-amber-500/8 text-amber-300',
};

export function DataSourceBanner({ repository, compact = false }: { repository: MaintainerRepositorySummary; compact?: boolean }) {
  const run = repository.latestImportRun;
  const source = repository.dataSource;

  return (
    <section className={cn('rounded-xl border border-white/8 bg-[#080d14] p-4', compact && 'p-3')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide', MODE_STYLES[repository.dataMode])}>
          {repository.dataMode}
        </span>
        <span className="text-xs text-zinc-500">
          {source?.provider ?? 'fixture'} source
          {repository.importedAt ? ` · imported ${formatUtcDateTime(repository.importedAt)}` : ''}
        </span>
        {run && (
          <span className="ml-auto text-xs text-zinc-500">
            {run.status} · {run.importedIssueCount}/{run.requestedLimit} issues · {run.skippedPullRequestCount} PRs skipped
          </span>
        )}
      </div>
      {source?.fallbackReason && (
        <p className="mt-2 text-xs leading-relaxed text-amber-300">{source.fallbackReason}</p>
      )}
      {run?.errorMessage && (
        <p className="mt-2 text-xs leading-relaxed text-red-300">{run.errorMessage}</p>
      )}
    </section>
  );
}
