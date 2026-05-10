import { EvidenceBadge } from './evidence-badge';
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

export function ProviderStatusBar({ providers = DEFAULT_PROVIDERS }: { providers?: ProviderStatusViewModel[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8 sm:grid-cols-2 xl:grid-cols-4">
      {providers.map((provider) => (
        <div key={provider.provider} className="bg-[#080d14] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">{provider.label}</span>
            <EvidenceBadge sourceState={provider.sourceState} />
          </div>
          <p className="mt-1 text-[11px] capitalize text-zinc-500">{provider.status}{provider.lastRunAt ? ` · ${formatUtcDateTime(provider.lastRunAt)}` : ''}</p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600">{provider.detail}</p>
        </div>
      ))}
    </div>
  );
}
