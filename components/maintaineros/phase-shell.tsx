import { ProviderStatusBar } from './provider-status-bar';
import { DataSourceBanner } from './data-source-banner';
import type { MaintainerRepositorySummary, ProviderStatusViewModel } from '@/lib/maintaineros/types';
import type React from 'react';

interface PhaseShellProps {
  eyebrow: string;
  title: string;
  description: string;
  repository?: MaintainerRepositorySummary;
  providerStatuses?: ProviderStatusViewModel[];
  children?: React.ReactNode;
}

export function PhaseShell({ eyebrow, title, description, repository, providerStatuses, children }: PhaseShellProps) {
  return (
    <div className="w-full max-w-6xl space-y-6 p-5 sm:p-6 lg:p-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-1">{eyebrow}</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">{description}</p>
      </header>
      {repository && <DataSourceBanner repository={repository} compact />}
      <ProviderStatusBar providers={providerStatuses} />
      {children}
    </div>
  );
}
