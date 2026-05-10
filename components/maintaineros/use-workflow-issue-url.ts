'use client';

import { useCallback, useSyncExternalStore } from 'react';

const WORKFLOW_ISSUE_EVENT = 'maintaineros:workflow-issue-change';

export function useWorkflowIssueUrl() {
  const workflowIssueNumber = useSyncExternalStore(subscribeToWorkflowIssueUrl, readWorkflowIssueNumber, () => null);

  const openWorkflowIssue = useCallback((issueNumber: number) => {
    if (!Number.isInteger(issueNumber) || issueNumber < 1) return;
    const current = readWorkflowIssueNumber();
    if (current === issueNumber) return;
    writeWorkflowIssueNumber(issueNumber, 'push');
  }, []);

  const closeWorkflowIssue = useCallback(() => {
    writeWorkflowIssueNumber(null, 'replace');
  }, []);

  return { workflowIssueNumber, openWorkflowIssue, closeWorkflowIssue };
}

function readWorkflowIssueNumber() {
  if (typeof window === 'undefined') return null;
  const raw = new URL(window.location.href).searchParams.get('workflowIssue');
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function writeWorkflowIssueNumber(issueNumber: number | null, mode: 'push' | 'replace') {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (issueNumber) {
    url.searchParams.set('workflowIssue', String(issueNumber));
  } else {
    url.searchParams.delete('workflowIssue');
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (mode === 'push') {
    window.history.pushState(null, '', nextUrl);
  } else {
    window.history.replaceState(null, '', nextUrl);
  }
  window.dispatchEvent(new Event(WORKFLOW_ISSUE_EVENT));
}

function subscribeToWorkflowIssueUrl(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('popstate', onStoreChange);
  window.addEventListener(WORKFLOW_ISSUE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener(WORKFLOW_ISSUE_EVENT, onStoreChange);
  };
}
