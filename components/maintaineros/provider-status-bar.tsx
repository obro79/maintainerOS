import { EvidenceBadge } from './evidence-badge';
import { cn } from '@/lib/utils';
import { formatUtcDateTime } from '@/lib/maintaineros/format';
import type { ProviderStatusViewModel } from '@/lib/maintaineros/types';

const DEFAULT_PROVIDERS: ProviderStatusViewModel[] = [
  { provider: 'github', label: 'GitHub', status: 'planned', sourceState: 'planned', detail: 'Import status pending.' },
  { provider: 'neon', label: 'Neon', status: 'planned', sourceState: 'planned', detail: 'Persistence pending.' },
  { provider: 'clod', label: 'CLōD', status: 'planned', sourceState: 'planned', detail: 'Model run pending.' },
  { provider: 'nia', label: 'Nia', status: 'planned', sourceState: 'planned', detail: 'Context pack pending.' },
  { provider: 'daytona', label: 'Daytona', status: 'planned', sourceState: 'planned', detail: 'Sandbox pending.' },
  { provider: 'greptile', label: 'Greptile', status: 'planned', sourceState: 'planned', detail: 'Verification pending.' },
  { provider: 'clustly', label: 'Clustly', status: 'planned', sourceState: 'planned', detail: 'Task rail pending.' },
];

const STATUS_STYLES: Record<ProviderStatusViewModel['status'], string> = {
  connected: 'bg-[#3F72AF] text-[#05070A]',
  degraded: 'bg-[#DBE2EF] text-[#05070A]',
  disconnected: 'bg-[#DBE2EF] text-[#05070A]',
  planned: 'bg-[#112D4E] text-[#F9F7F7]/76',
};

export function ProviderStatusBar({ providers = DEFAULT_PROVIDERS }: { providers?: ProviderStatusViewModel[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-[#F9F7F7]/12 bg-[#F9F7F7]/8 sm:grid-cols-2 xl:grid-cols-7">
      {providers.map((provider) => (
        <div key={provider.provider} className="bg-[#0A111A] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">{provider.label}</span>
            <EvidenceBadge sourceState={provider.sourceState} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('size-1.5 rounded-full', STATUS_STYLES[provider.status])} />
            <p className="min-w-0 truncate text-[11px] capitalize text-[#F9F7F7]/56">
              {provider.status}{provider.lastRunAt ? ` · ${formatUtcDateTime(provider.lastRunAt)}` : ''}
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#F9F7F7]/40">{provider.detail}</p>
        </div>
      ))}
    </div>
  );
}
