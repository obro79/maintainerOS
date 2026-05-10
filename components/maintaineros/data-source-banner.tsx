import type { MaintainerRepositorySummary } from '@/lib/maintaineros/types';
import { formatUtcDateTime } from '@/lib/maintaineros/format';
import { cn } from '@/lib/utils';

const MODE_STYLES = {
  live: 'border-[#3F72AF]/25 bg-[#3F72AF]/8 text-[#DBE2EF]',
  rehearsal: 'border-sky-500/25 bg-sky-500/8 text-sky-300',
  fixture: 'border-[#DBE2EF]/25 bg-[#DBE2EF]/8 text-[#DBE2EF]',
};

export function DataSourceBanner({ repository, compact = false }: { repository: MaintainerRepositorySummary; compact?: boolean }) {
  const run = repository.latestImportRun;
  const source = repository.dataSource;

  return (
    <section className={cn('rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-4', compact && 'p-3')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-sans uppercase tracking-wide', MODE_STYLES[repository.dataMode])}>
          {repository.dataMode}
        </span>
        <span className="text-xs text-[#F9F7F7]/56">
          {source?.provider ?? 'fixture'} source
          {repository.importedAt ? ` · imported ${formatUtcDateTime(repository.importedAt)}` : ''}
        </span>
        {run && (
          <span className="ml-auto text-xs text-[#F9F7F7]/56">
            {run.status} · {run.importedIssueCount}/{run.requestedLimit} issues · {run.skippedPullRequestCount} PRs skipped
          </span>
        )}
      </div>
      {source?.fallbackReason && (
        <p className="mt-2 text-xs leading-relaxed text-[#DBE2EF]">{source.fallbackReason}</p>
      )}
      {run?.errorMessage && (
        <p className="mt-2 text-xs leading-relaxed text-[#DBE2EF]">{run.errorMessage}</p>
      )}
    </section>
  );
}
