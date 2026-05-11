import { EvidenceBadge } from './evidence-badge';
import { ContextPackPanel } from './context-pack-panel';
import type React from 'react';
import { ROUTE_LABEL } from '@/lib/maintaineros/types';
import type { IssueDetailViewModel } from '@/lib/maintaineros/types';

function ArtifactSection({ title, sourceState, children }: { title: string; sourceState?: IssueDetailViewModel['modelRun']['sourceState']; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {sourceState && <EvidenceBadge sourceState={sourceState} />}
      </div>
      {children}
    </section>
  );
}

export function IssueArtifactStack({ issue }: { issue: IssueDetailViewModel | null }) {
  if (!issue) {
    return (
      <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#F9F7F7]/[0.025] p-6">
        <p className="text-sm font-semibold text-white">No issue selected</p>
        <p className="mt-2 text-sm text-[#F9F7F7]/56">Select an issue to inspect its work order, context, sandbox, PR, verification, and payout artifacts.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ArtifactSection title="Work order">
        <p className="text-sm text-[#F9F7F7]/76">{issue.workOrder.title}</p>
        <p className="mt-1 text-xs text-[#F9F7F7]/40">{issue.workOrder.status} · {issue.workOrder.assigneeKind}{issue.workOrder.generatedBy ? ` · ${issue.workOrder.generatedBy}` : ''}</p>
        {issue.workOrder.rationale && <p className="mt-2 text-xs leading-relaxed text-[#F9F7F7]/56">{issue.workOrder.rationale}</p>}
        <div className="mt-3 rounded-lg border border-[#F9F7F7]/10 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Route policy</p>
          <p className={issue.routePolicy.automationAllowed ? 'mt-1 text-xs text-[#DBE2EF]' : 'mt-1 text-xs text-[#DBE2EF]'}>
            {issue.routePolicy.executionMode.toUpperCase()} · {issue.routePolicy.automationAllowed ? 'automation allowed' : 'automation blocked'}
          </p>
          <p className="mt-2 text-xs text-[#F9F7F7]/56">{issue.routePolicy.reasons.join(' ')}</p>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Acceptance</p>
            <ul className="mt-1 space-y-1">
              {issue.workOrder.acceptanceChecks.slice(0, 4).map((check) => (
                <li key={check} className="text-xs text-[#F9F7F7]/56">{check}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Files</p>
            <p className="mt-1 text-xs text-[#F9F7F7]/56">{issue.workOrder.suggestedFiles.join(', ') || 'unknown'}</p>
            {issue.workOrder.suggestedCommands && issue.workOrder.suggestedCommands.length > 0 && (
              <div className="mt-2 space-y-1">
                {issue.workOrder.suggestedCommands.map((command) => (
                  <code key={command} className="block rounded-lg border border-[#F9F7F7]/10 px-2 py-1 text-xs text-[#F9F7F7]/56">{command}</code>
                ))}
              </div>
            )}
          </div>
        </div>
      </ArtifactSection>

      <ArtifactSection title="Retry and reroute history" sourceState={issue.routeHistory[0]?.sourceState}>
        {issue.routeHistory.length > 0 ? (
          <div className="space-y-2">
            {issue.routeHistory.map((attempt) => (
              <div key={attempt.id} className="rounded-lg border border-[#F9F7F7]/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sans text-[10px] text-[#F9F7F7]/40">#{attempt.sequence}</span>
                  <span className="text-sm font-medium text-[#F9F7F7]/76">
                    {attempt.fromRoute ? `${ROUTE_LABEL[attempt.fromRoute]} -> ${ROUTE_LABEL[attempt.toRoute]}` : ROUTE_LABEL[attempt.toRoute]}
                  </span>
                  <span className="rounded-full border border-[#F9F7F7]/12 px-2 py-0.5 text-[10px] uppercase text-[#F9F7F7]/56">{attempt.trigger}</span>
                  <span className="rounded-full border border-[#F9F7F7]/12 px-2 py-0.5 text-[10px] uppercase text-[#F9F7F7]/56">{attempt.status}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#F9F7F7]/56">{attempt.reason}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#F9F7F7]/40">
                  {attempt.model && <span>Model: {attempt.model}</span>}
                  {attempt.costCents != null && <span>Cost: {attempt.costCents}c</span>}
                  <span>{new Date(attempt.occurredAt).toISOString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#F9F7F7]/76">No retry or reroute history has been recorded yet.</p>
        )}
      </ArtifactSection>

      <ArtifactSection title="CLōD model run" sourceState={issue.modelRun.sourceState}>
        <p className="text-sm text-[#F9F7F7]/76">{issue.modelRun.model} · {issue.modelRun.tier}</p>
        <p className="mt-1 text-xs text-[#F9F7F7]/40">{issue.modelRun.purpose} · {issue.modelRun.status} · {issue.modelRun.latencyMs}ms</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#F9F7F7]/56 md:grid-cols-4">
          <span>Input: {issue.modelRun.inputTokens ?? 'unknown'}</span>
          <span>Output: {issue.modelRun.outputTokens ?? 'unknown'}</span>
          <span>Cost: {issue.modelRun.estimatedCostCents == null ? 'unknown' : `${issue.modelRun.estimatedCostCents}c`}</span>
          <span>Baseline: {issue.modelRun.premiumBaselineCents == null ? 'unknown' : `${issue.modelRun.premiumBaselineCents}c`}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#F9F7F7]/56">{issue.modelRun.selectionReason}</p>
        {issue.modelRun.fallbackReason && <p className="mt-2 text-xs leading-relaxed text-[#DBE2EF]">{issue.modelRun.fallbackReason}</p>}
      </ArtifactSection>

      <ArtifactSection title="Nia context pack" sourceState={issue.contextPack?.sourceState}>
        <ContextPackPanel contextPack={issue.contextPack} />
      </ArtifactSection>

      <ArtifactSection title="Daytona sandbox" sourceState={issue.sandboxExecutions[0]?.sourceState}>
        {issue.sandboxExecutions.length > 0 ? (
          <div className="space-y-3">
            <p className="mt-2 text-xs text-[#DBE2EF]">Sandbox output is execution evidence only. Greptile verification decides correctness in Phase 5.</p>
            {issue.sandboxExecutions.map((attempt, index) => (
              <div key={attempt.id} className="rounded-lg border border-[#F9F7F7]/10 p-3">
                <p className="text-sm text-[#F9F7F7]/76">{attempt.logSummary}</p>
                <p className="mt-1 text-xs text-[#F9F7F7]/40">
                  Attempt {index + 1} · {attempt.status} · {attempt.contextMode} · {attempt.sandboxId} · exit {attempt.exitCode ?? 'pending'}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Command results</p>
                    <div className="mt-2 space-y-1">
                      {attempt.commandResults.map((command) => (
                        <code key={`${attempt.id}-${command.command}`} className="block rounded-lg border border-[#F9F7F7]/10 px-2 py-1 text-xs text-[#F9F7F7]/56">
                          {command.status} · {command.command} · exit {command.exitCode ?? 'n/a'}
                        </code>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Files touched</p>
                    <p className="mt-2 text-xs text-[#F9F7F7]/56">{attempt.filesTouched.join(', ') || 'none recorded'}</p>
                    {attempt.pullRequestUrl && (
                      <a className="mt-2 inline-flex text-xs text-[#DBE2EF]" href={attempt.pullRequestUrl}>
                        PR artifact
                      </a>
                    )}
                    {attempt.failureReason && <p className="mt-2 text-xs text-[#DBE2EF]">{attempt.failureReason}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#F9F7F7]/76">No sandbox attempt is attached yet for this route.</p>
        )}
      </ArtifactSection>

      <ArtifactSection title="Greptile verification" sourceState={issue.verification?.sourceState}>
        {issue.verification ? (
          <div>
            {issue.pullRequest && (
              <p className="text-sm text-[#F9F7F7]/76">
                PR #{issue.pullRequest.number}: <a className="text-[#DBE2EF]" href={issue.pullRequest.htmlUrl}>{issue.pullRequest.title}</a>
              </p>
            )}
            <p className="mt-2 text-sm text-[#F9F7F7]/76">{issue.verification.summary}</p>
            {issue.verification.isStale && (
              <p className="mt-2 rounded-lg border border-[#DBE2EF]/20 bg-[#DBE2EF]/10 px-3 py-2 text-xs text-[#DBE2EF]">
                SHA mismatch blocks completion and payout until Greptile reruns on the current PR head.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#F9F7F7]/56 md:grid-cols-4">
              <span>Status: {issue.verification.status}</span>
              <span>Findings: {issue.verification.blockingFindingsCount}</span>
              <span>Verified: {issue.verification.verifiedSha ?? 'pending'}</span>
              <span>Current: {issue.verification.currentSha ?? 'unknown'}</span>
            </div>
            <p className="mt-2 text-xs text-[#F9F7F7]/56">{issue.verification.riskSummary}</p>
            {issue.verification.failureReason && <p className="mt-2 text-xs text-[#DBE2EF]">{issue.verification.failureReason}</p>}
            {(issue.verification.comments ?? []).length > 0 && (
              <div className="mt-4 rounded-lg border border-[#F9F7F7]/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Greptile comments</p>
                <div className="mt-2 space-y-2">
                  {(issue.verification.comments ?? []).slice(0, 4).map((comment) => (
                    <a key={comment.id} className="block rounded-lg border border-[#F9F7F7]/10 p-2 text-xs text-[#F9F7F7]/56 hover:border-[#DBE2EF]/30 hover:text-[#DBE2EF]" href={comment.htmlUrl}>
                      <span className="text-[#F9F7F7]/76">{comment.authorLogin}</span>
                      {comment.path && <span className="text-[#F9F7F7]/40"> · {comment.path}{comment.line ? `:${comment.line}` : ''}</span>}
                      <span className="mt-1 block leading-relaxed">{comment.body}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Criteria</p>
                <ul className="mt-2 space-y-1">
                  {issue.verification.criteria.slice(0, 4).map((criterion) => (
                    <li key={criterion} className="text-xs text-[#F9F7F7]/56">{criterion}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Files inspected</p>
                <p className="mt-2 text-xs text-[#F9F7F7]/56">{(issue.verification.filesInspected ?? issue.verification.filesTouched).join(', ') || 'none recorded'}</p>
                {(issue.verification.blockingFindings ?? []).map((finding) => (
                  <p key={finding} className="mt-2 text-xs text-[#DBE2EF]">{finding}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#F9F7F7]/76">No Greptile proof is linked yet. Completion and payout stay blocked until fresh verification passes.</p>
        )}
      </ArtifactSection>

      <ArtifactSection title="Clustly release gate" sourceState={issue.paymentArtifact?.sourceState}>
        {issue.route !== 'bounty-worthy' ? (
          <p className="text-sm text-[#F9F7F7]/76">No payout artifact: Clustly is only used for bounty-worthy issues.</p>
        ) : (
          <div>
            {issue.paymentArtifact ? (
              <>
                <p className="text-sm text-[#F9F7F7]/76">{issue.paymentArtifact.releaseReason}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#F9F7F7]/56 md:grid-cols-4">
                  <span>Status: {issue.paymentArtifact.status}</span>
                  <span>Amount: {(issue.paymentArtifact.amountCents / 100).toFixed(0)} {issue.paymentArtifact.currency}</span>
                  <span>Funding: {issue.paymentArtifact.fundingMode ?? 'manual-browser'}</span>
                  <span>Claim: {issue.paymentArtifact.claimId ?? 'pending'}</span>
                </div>
                {issue.paymentArtifact.taskUrl && <a className="mt-2 inline-flex text-xs text-[#DBE2EF]" href={issue.paymentArtifact.taskUrl}>Open Clustly task</a>}
                {issue.paymentArtifact.artifactUrl && <a className="ml-3 mt-2 inline-flex text-xs text-[#DBE2EF]" href={issue.paymentArtifact.artifactUrl}>Release artifact</a>}
              </>
            ) : (
              <p className="text-sm text-[#F9F7F7]/76">Bounty route selected, but no Clustly task artifact is attached yet.</p>
            )}
            <div className="mt-3 rounded-lg border border-[#F9F7F7]/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#F9F7F7]/28">Release gate</p>
              <p className={issue.payoutGate.canRelease ? 'mt-1 text-xs text-[#DBE2EF]' : 'mt-1 text-xs text-[#DBE2EF]'}>
                {issue.payoutGate.canRelease ? 'Release allowed' : 'Release blocked'}
              </p>
              {!issue.payoutGate.canRelease && (
                <ul className="mt-2 space-y-1">
                  {issue.payoutGate.reasonDetails.map((reason) => (
                    <li key={reason.code} className="text-xs text-[#F9F7F7]/56">
                      <span className="font-sans text-[#F9F7F7]/40">{reason.code}</span> · {reason.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </ArtifactSection>
    </div>
  );
}
