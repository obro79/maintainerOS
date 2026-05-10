'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RouteIssueButton({ repositoryId, issueNumber }: { repositoryId: string; issueNumber: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setStatus('running');
    setMessage(null);
    const response = await fetch('/api/maintaineros/route-issue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repositoryId, issueNumber }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      setStatus('failed');
      setMessage(payload.error ?? 'Route run failed.');
      return;
    }
    setStatus('done');
    setMessage(payload.fallbackReason ?? `Saved ${payload.modelRun?.status ?? 'model'} artifact.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={status === 'running'}
        className="rounded-lg border border-[#3F72AF]/30 bg-[#3F72AF]/10 px-3 py-1.5 text-xs text-[#DBE2EF] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'running' ? 'Running CLōD...' : 'Run CLōD route'}
      </button>
      {message && <span className={status === 'failed' ? 'text-xs text-[#DBE2EF]' : 'text-xs text-[#F9F7F7]/56'}>{message}</span>}
    </div>
  );
}
