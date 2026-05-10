'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Award, Bot, CheckCircle2, FileCheck2, LayoutDashboard, List, RotateCcw, ScrollText, ChevronRight, GitMerge } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '',          label: 'Overview',  icon: LayoutDashboard },
  { href: '/backlog',  label: 'Backlog',   icon: List            },
  { href: '/agents',   label: 'Agents',    icon: Bot             },
  { href: '/verification', label: 'Verify', icon: CheckCircle2   },
  { href: '/bounties', label: 'Bounties',  icon: Award           },
  { href: '/evals',    label: 'Evals',     icon: Activity        },
  { href: '/audit',    label: 'Audit',     icon: ScrollText      },
  { href: '/proof',    label: 'Proof',     icon: FileCheck2      },
];

interface RepoSidebarProps {
  org: string;
  repo: string;
}

export function RepoSidebar({ org, repo }: RepoSidebarProps) {
  const pathname = usePathname();
  const base = `/${org}/${repo}`;

  return (
    <aside className="w-[220px] shrink-0 flex flex-col border-r border-white/6 bg-[#030509] h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-white/6">
        <Link href="/" className="font-heading font-bold text-[14px] tracking-tight text-white flex items-center gap-2">
          <div className="size-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <GitMerge className="size-3.5 text-emerald-400" />
          </div>
          MaintainerOS
        </Link>
      </div>

      {/* Repo context */}
      <div className="px-4 py-3 border-b border-white/6">
        <div className="text-[10px] text-zinc-700 mb-1 font-mono uppercase tracking-wider">Repository</div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-zinc-600 text-[11px] truncate">{org}</span>
          <ChevronRight className="size-2.5 text-zinc-700 shrink-0" />
          <span className="text-white text-[11px] font-semibold truncate">{repo}</span>
          {/* Health dot */}
          <div className="ml-auto size-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_4px_#22c55e]" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const to = `${base}${href}`;
          const isActive = href === ''
            ? pathname === base
            : pathname.startsWith(to) || (href === '/audit' && pathname.startsWith(`${base}/issues/`));
          return (
            <Link
              key={label}
              href={to}
              className={cn(
                'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group',
                isActive
                  ? 'text-emerald-400 font-medium'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]',
              )}>
              {/* Active gradient bg */}
              {isActive && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/15 to-transparent" />
              )}
              {/* Active left bar */}
              {isActive && (
                <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
              )}
              <Icon className={cn('size-4 shrink-0 relative z-10', isActive ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-400')} />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Live CLOD indicator */}
      <div className="px-4 pb-4">
        <Link
          href="/demo/reset"
          className="mb-2 flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300">
          <RotateCcw className="size-3.5" />
          Demo reset
        </Link>
        <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-mono text-emerald-400">CLOD routing</span>
          </div>
          <div className="text-[10px] text-zinc-700">Last run 4m ago</div>
        </div>
      </div>
    </aside>
  );
}
