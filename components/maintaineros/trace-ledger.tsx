'use client';

import { useMemo, useState } from 'react';
import { EvidenceBadge } from './evidence-badge';
import { formatUtcDateTime } from '@/lib/maintaineros/format';
import { ROUTE_LABEL } from '@/lib/maintaineros/types';
import type { ExecutionRoute, IssueTraceEventViewModel } from '@/lib/maintaineros/types';

export function TraceLedger({ events = [] }: { events?: IssueTraceEventViewModel[] }) {
  const [provider, setProvider] = useState('all');
  const [route, setRoute] = useState('all');
  const [status, setStatus] = useState('all');
  const [sourceState, setSourceState] = useState('all');
  const sorted = useMemo(() => [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()), [events]);
  const filtered = sorted.filter((event) => {
    if (provider !== 'all' && event.provider !== provider) return false;
    if (route !== 'all' && event.route !== route) return false;
    if (status !== 'all' && event.status !== status) return false;
    if (sourceState !== 'all' && event.sourceState !== sourceState) return false;
    return true;
  });
  const providers = unique(sorted.map((event) => event.provider).filter(Boolean));
  const routes = unique(sorted.map((event) => event.route).filter(Boolean));
  const statuses = unique(sorted.map((event) => event.status));
  const sourceStates = unique(sorted.map((event) => event.sourceState).filter(Boolean));

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#F9F7F7]/[0.025] p-6">
        <p className="text-sm font-semibold text-white">No trace events yet</p>
        <p className="mt-2 text-sm text-[#F9F7F7]/56">Route, context, sandbox, verification, and payout events will appear here as artifacts are created.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-3">
        <Filter label="Provider" value={provider} values={providers} onChange={setProvider} />
        <Filter label="Route" value={route} values={routes} labels={ROUTE_LABEL} onChange={setRoute} />
        <Filter label="Status" value={status} values={statuses} onChange={setStatus} />
        <Filter label="Source" value={sourceState} values={sourceStates} onChange={setSourceState} />
        <button
          type="button"
          onClick={() => {
            setProvider('all');
            setRoute('all');
            setStatus('all');
            setSourceState('all');
          }}
          className="ml-auto rounded-lg border border-[#F9F7F7]/12 px-2 py-1 text-xs text-[#F9F7F7]/56 hover:text-[#F9F7F7]/76"
        >
          All events
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#F9F7F7]/[0.025] p-6">
          <p className="text-sm font-semibold text-white">No matching trace events</p>
          <p className="mt-2 text-sm text-[#F9F7F7]/56">Clear filters to inspect the full historical ledger.</p>
        </div>
      )}

      {filtered.map((event) => (
        <div id={event.id} key={event.id} className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{event.title}</span>
            <span className="rounded-full border border-[#F9F7F7]/12 px-2 py-0.5 text-[10px] font-sans uppercase text-[#F9F7F7]/56">{event.status}</span>
            {event.route && <span className="rounded-full border border-[#F9F7F7]/12 px-2 py-0.5 text-[10px] text-[#F9F7F7]/56">{ROUTE_LABEL[event.route]}</span>}
            {event.sourceState && <EvidenceBadge sourceState={event.sourceState} />}
            <span className="ml-auto text-[10px] font-sans text-[#F9F7F7]/40">{formatUtcDateTime(event.at)}</span>
          </div>
          <p className="mt-1 text-xs text-[#F9F7F7]/56">{event.actor}{event.provider ? ` · ${event.provider}` : ''}</p>
          <p className="mt-2 text-sm leading-relaxed text-[#F9F7F7]/68">{event.detail}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#F9F7F7]/40">
            {event.model && <span>Model: {event.model}</span>}
            {event.costCents != null && <span>Cost: {event.costCents}c</span>}
            {event.relatedId && <span>Related: {event.relatedId}</span>}
            {event.artifactUrl && <a className="text-[#DBE2EF]" href={event.artifactUrl}>Artifact</a>}
          </div>
          {event.filesTouched && event.filesTouched.length > 0 && (
            <p className="mt-2 text-xs text-[#F9F7F7]/40">Files: {event.filesTouched.join(', ')}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Filter({ label, value, values, labels, onChange }: { label: string; value: string; values: string[]; labels?: Partial<Record<ExecutionRoute, string>>; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-[#F9F7F7]/40">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-[#F9F7F7]/12 bg-[#05070A] px-2 py-1 text-[#F9F7F7]/68">
        <option value="all">all</option>
        {values.map((option) => <option key={option} value={option}>{labels?.[option as ExecutionRoute] ?? option}</option>)}
      </select>
    </label>
  );
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}
