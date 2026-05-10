import { EvidenceBadge } from './evidence-badge';
import type { DemoResetScenarioViewModel } from '@/lib/maintaineros/types';

const SCENARIOS: DemoResetScenarioViewModel[] = [
  { id: 'happy-path', label: 'Happy path', sourceState: 'planned', description: 'Import, route, verify, and release without interruption.' },
  { id: 'failed-cheap-attempt', label: 'Failed cheap attempt', sourceState: 'planned', description: 'Show failed low-cost execution and escalation.' },
  { id: 'stale-verification', label: 'Stale verification', sourceState: 'planned', description: 'Show PR changed after verification and payout blocked.' },
  { id: 'bounty-release-blocked', label: 'Bounty blocked', sourceState: 'planned', description: 'Show Clustly release blocked before maintainer acceptance.' },
  { id: 'bounty-released', label: 'Bounty released', sourceState: 'planned', description: 'Show verified work released through Clustly.' },
];

export function DemoResetPanel({ scenarios = SCENARIOS }: { scenarios?: DemoResetScenarioViewModel[] }) {
  return (
    <div className="grid gap-3">
      {scenarios.map((scenario) => (
        <div key={scenario.id} className="rounded-xl border border-white/8 bg-[#080d14] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">{scenario.label}</h3>
            <EvidenceBadge sourceState={scenario.sourceState} />
          </div>
          <p className="mt-2 text-sm text-zinc-500">{scenario.description}</p>
          <button className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400" type="button">
            Planned reset action
          </button>
        </div>
      ))}
    </div>
  );
}
