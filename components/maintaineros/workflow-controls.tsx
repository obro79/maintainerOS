'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IssueDetailViewModel } from '@/lib/maintaineros/types';

type Action = 'run-agent' | 'link-pr' | 'verify-pr';
type Status = 'idle' | 'running' | 'done' | 'failed';

export function WorkflowControls({ repositoryId, issue }: { repositoryId: string; issue: IssueDetailViewModel }) {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [pullRequestUrl, setPullRequestUrl] = useState(issue.pullRequest?.htmlUrl ?? '');
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const agentAllowed = issue.route === 'agent-solvable' && issue.routePolicy.automationAllowed;
  const canRunAgent = agentAllowed && Boolean(token.trim());
  const canLinkPr = Boolean(token.trim()) && Boolean(pullRequestUrl.trim());
  const canVerifyPr = Boolean(token.trim()) && Boolean(issue.pullRequest);

  async function post(action: Action, path: string, body: Record<string, unknown>) {
    setActiveAction(action);
    setStatus('running');
    setMessage(null);
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.trim()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      setStatus('failed');
      setMessage(payload.error ?? `${action} failed.`);
      return;
    }
    setStatus('done');
    setMessage(successMessage(action, payload));
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-white/8 bg-[#080d14] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Workflow controls</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
            Run agent execution, attach a PR, and request Greptile verification. Mutating actions require the workflow API token.
          </p>
        </div>
        <span className={agentAllowed ? 'rounded-full border border-emerald-500/25 px-2 py-1 text-[10px] uppercase text-emerald-300' : 'rounded-full border border-amber-500/25 px-2 py-1 text-[10px] uppercase text-amber-300'}>
          {agentAllowed ? 'Agent allowed' : 'Agent blocked'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.3fr]">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-700">Workflow token</span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/40"
            placeholder="MAINTAINEROS_WORKFLOW_API_TOKEN"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-700">Pull request URL</span>
          <input
            value={pullRequestUrl}
            onChange={(event) => setPullRequestUrl(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500/40"
            placeholder={`https://github.com/${repositoryId}/pull/123`}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <WorkflowButton
          disabled={!canRunAgent || status === 'running'}
          running={activeAction === 'run-agent' && status === 'running'}
          label="Run agent"
          onClick={() => post('run-agent', '/api/maintaineros/run-agent', { repositoryId, issueNumber: issue.number })}
        />
        <WorkflowButton
          disabled={!canLinkPr || status === 'running'}
          running={activeAction === 'link-pr' && status === 'running'}
          label={issue.pullRequest ? 'Relink PR' : 'Link PR'}
          onClick={() => post('link-pr', '/api/maintaineros/link-pr', { repositoryId, issueNumber: issue.number, pullRequestUrl })}
        />
        <WorkflowButton
          disabled={!canVerifyPr || status === 'running'}
          running={activeAction === 'verify-pr' && status === 'running'}
          label="Verify PR"
          onClick={() => post('verify-pr', '/api/maintaineros/verify-pr', { repositoryId, issueNumber: issue.number })}
        />
      </div>

      {!agentAllowed && (
        <p className="mt-3 text-xs text-amber-300">{issue.routePolicy.reasons.join(' ')}</p>
      )}
      {message && (
        <p className={status === 'failed' ? 'mt-3 text-xs text-red-300' : 'mt-3 text-xs text-zinc-500'}>{message}</p>
      )}
    </section>
  );
}

function WorkflowButton({ disabled, running, label, onClick }: { disabled: boolean; running: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
    >
      {running ? 'Running...' : label}
    </button>
  );
}

function successMessage(action: Action, payload: Record<string, unknown>) {
  if (action === 'run-agent') return 'Agent execution recorded.';
  if (action === 'link-pr') return 'Pull request linked.';
  const verification = payload.verification as { status?: string } | undefined;
  return `Verification ${verification?.status ?? 'recorded'}.`;
}
