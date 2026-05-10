import Link from 'next/link';
import { DemoResetPanel } from '@/components/maintaineros/demo-reset-panel';
import { PhaseShell } from '@/components/maintaineros/phase-shell';

export const metadata = {
  title: 'Demo Reset — MaintainerOS',
  description: 'Reset and rehearse MaintainerOS demo scenarios.',
};

export default function DemoResetPage() {
  return (
    <div className="min-h-screen bg-[#030509] text-white">
      <PhaseShell
        eyebrow="Presenter tooling"
        title="Demo Reset"
        description="Scenario controls for rehearsals. Phase 10 wires these actions to live/rehearsal artifacts."
      >
        <Link className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400" href="/demo">
          Back to demo
        </Link>
        <DemoResetPanel />
      </PhaseShell>
    </div>
  );
}
