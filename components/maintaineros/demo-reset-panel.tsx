'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Play, RefreshCw, RotateCcw } from 'lucide-react';
import { EvidenceBadge } from './evidence-badge';
import type { DemoResetScenarioViewModel } from '@/lib/maintaineros/types';

interface DemoResetPanelProps {
  scenarios: DemoResetScenarioViewModel[];
  selectedScenarioId: string;
}

type Action = 'select' | 'reset' | 'rerun-import' | 'replay-artifacts';

export function DemoResetPanel({ scenarios, selectedScenarioId }: DemoResetPanelProps) {
  const [selected, setSelected] = useState(selectedScenarioId);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(action: Action, scenarioId = selected) {
    setPendingAction(action);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/maintaineros/demo/${action}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenarioId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? `Demo action failed: ${action}`);
        }
        if (action === 'select') setSelected(scenarioId);
        setMessage(payload.message ?? 'Demo action completed.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Demo action failed.');
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-[#080d14] p-3">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-50"
          disabled={isPending}
          onClick={() => runAction('reset')}
          type="button"
        >
          <RotateCcw className="size-3.5" />
          Reset local demo state
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-50"
          disabled={isPending}
          onClick={() => runAction('rerun-import')}
          type="button"
        >
          <RefreshCw className="size-3.5" />
          Rerun GitHub import
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
          disabled={isPending}
          onClick={() => runAction('replay-artifacts')}
          type="button"
        >
          <Play className="size-3.5" />
          Replay provider artifacts
        </button>
        {message && <span className="text-xs text-zinc-500">{message}</span>}
      </div>

      {scenarios.map((scenario) => {
        const active = selected === scenario.id;
        return (
          <div key={scenario.id} className="rounded-xl border border-white/8 bg-[#080d14] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{scenario.label}</h3>
                  {active && <CheckCircle2 className="size-3.5 text-emerald-400" />}
                </div>
                <p className="mt-1 text-xs text-zinc-600">Issue #{scenario.targetIssueNumber} · {scenario.expectedRoute}</p>
              </div>
              <EvidenceBadge sourceState={scenario.sourceState} />
            </div>
            <p className="mt-2 text-sm text-zinc-500">{scenario.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-50"
                disabled={isPending || active}
                onClick={() => runAction('select', scenario.id)}
                type="button"
              >
                {pendingAction === 'select' && selected === scenario.id ? 'Selecting...' : active ? 'Selected' : 'Select scenario'}
              </button>
              {scenario.traceAnchors.map((anchor) => (
                <span key={anchor} className="rounded-full border border-white/8 px-2 py-1 text-[10px] font-mono text-zinc-600">
                  #{anchor}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
