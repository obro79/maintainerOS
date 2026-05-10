'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent: 'primary' | 'soft' | 'deep' | 'muted' | 'light';
  icon?: React.ElementType;
  index?: number;
}

const ACCENT_MAP = {
  primary: { text: 'text-[#3F72AF]', bar: 'bg-[#3F72AF]', glow: 'shadow-[#3F72AF]/15' },
  soft:    { text: 'text-[#DBE2EF]', bar: 'bg-[#DBE2EF]', glow: 'shadow-[#DBE2EF]/12' },
  deep:    { text: 'text-[#DBE2EF]', bar: 'bg-[#112D4E]', glow: 'shadow-[#112D4E]/20' },
  muted:   { text: 'text-[#F9F7F7]/68', bar: 'bg-[#112D4E]', glow: '' },
  light:   { text: 'text-[#F9F7F7]', bar: 'bg-[#F9F7F7]', glow: 'shadow-[#F9F7F7]/10' },
} as const;

export function StatCard({ label, value, sub, accent, icon: Icon, index = 0 }: StatCardProps) {
  const a = ACCENT_MAP[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-5 overflow-hidden',
        a.glow && `shadow-lg ${a.glow}`,
      )}>
      {/* Top accent bar */}
      <div className={cn('absolute top-0 left-0 right-0 h-[2px]', a.bar)} />

      <div className="flex items-start justify-between mb-4">
        <div className="text-xs text-[#F9F7F7]/56 font-medium">{label}</div>
        {Icon && <Icon className={cn('size-4 shrink-0', a.text)} />}
      </div>

      <div className={cn(
        'font-heading font-semibold text-4xl text-white tracking-tight leading-none mb-1',
        '[font-variant-numeric:tabular-nums]',
      )}>
        {value}
      </div>

      {sub && <div className="text-xs text-[#F9F7F7]/40 mt-2">{sub}</div>}
    </motion.div>
  );
}
