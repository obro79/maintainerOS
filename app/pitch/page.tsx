import { PhaseShell } from '@/components/maintaineros/phase-shell';

export const metadata = {
  title: 'Pitch Assets — MaintainerOS',
  description: 'MaintainerOS pitch assets, diagrams, and demo script.',
};

export default function PitchPage() {
  return (
    <div className="min-h-screen bg-[#030509] text-white">
      <PhaseShell
        eyebrow="Pitch"
        title="Pitch Assets"
        description="Hera/YC motion storyboard, architecture diagram, data flow, traceability diagram, eval methodology, sponsor map, and final demo script."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {['Architecture diagram', 'Data-flow diagram', 'Traceability diagram', 'Eval methodology', 'Sponsor map', 'Demo script'].map((asset) => (
            <section key={asset} className="rounded-xl border border-white/8 bg-[#080d14] p-4">
              <h2 className="text-sm font-semibold text-white">{asset}</h2>
              <p className="mt-2 text-sm text-zinc-500">Planned in Phase 12. This page reserves the pitch asset surface.</p>
            </section>
          ))}
        </div>
      </PhaseShell>
    </div>
  );
}
