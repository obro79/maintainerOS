import { cn } from '@/lib/utils';
import { lane } from '@/lib/design-system';

interface LaneBadgeProps {
  value: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function LaneBadge({ value, size = 'sm', className }: LaneBadgeProps) {
  const l = lane(value);
  return (
    <span className={cn(
      'inline-flex items-center font-mono font-bold tracking-wide rounded border',
      size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1',
      l.tw.bgMuted, l.tw.text, l.tw.borderMuted,
      className,
    )}>
      {value.toUpperCase()}
    </span>
  );
}
