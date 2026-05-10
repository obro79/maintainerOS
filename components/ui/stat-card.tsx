'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent: 'emerald' | 'amber' | 'violet' | 'zinc' | 'red' | 'blue';
  icon?: React.ElementType;
  index?: number;
}

const ACCENT_MAP = {
  emerald: { text: 'text-emerald-400', bar: 'bg-emerald-500', glow: 'shadow-emerald-500/15' },
  amber:   { text: 'text-amber-400',   bar: 'bg-amber-500',   glow: 'shadow-amber-500/15'   },
  violet:  { text: 'text-violet-400',  bar: 'bg-violet-500',  glow: 'shadow-violet-500/15'  },
  zinc:    { text: 'text-zinc-400',    bar: 'bg-zinc-600',    glow: ''                       },
  red:     { text: 'text-red-400',     bar: 'bg-red-500',     glow: 'shadow-red-500/15'      },
  blue:    { text: 'text-blue-400',    bar: 'bg-blue-500',    glow: 'shadow-blue-500/15'     },
} as const;

export function StatCard({ label, value, sub, accent, icon: Icon, index = 0 }: StatCardProps) {
  const a = ACCENT_MAP[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative rounded-xl border border-white/8 bg-[#080d14] p-5 overflow-hidden',
        a.glow && `shadow-lg ${a.glow}`,
      )}>
      {/* Top accent bar */}
      <div className={cn('absolute top-0 left-0 right-0 h-[2px]', a.bar)} />

      <div className="flex items-start justify-between mb-4">
        <div className="text-xs text-zinc-500 font-medium">{label}</div>
        {Icon && <Icon className={cn('size-4 shrink-0', a.text)} />}
      </div>

      <div className={cn(
        'font-heading font-bold text-4xl text-white tracking-tight leading-none mb-1',
        '[font-variant-numeric:tabular-nums]',
      )}>
        {value}
      </div>

      {sub && <div className="text-xs text-zinc-600 mt-2">{sub}</div>}
    </motion.div>
  );
}
