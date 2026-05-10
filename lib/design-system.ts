// MaintainerOS Design System
// The four routing lanes are the primary design language.
// All color decisions derive from LANE_CONFIG.

export const LANE_CONFIG = {
  agent: {
    label: 'Agent',
    color: '#22c55e',
    tw: {
      text:         'text-emerald-400',
      textBright:   'text-emerald-300',
      bg:           'bg-emerald-500',
      bgFaint:      'bg-emerald-500/8',
      bgMuted:      'bg-emerald-950',
      border:       'border-emerald-500/30',
      borderBright: 'border-emerald-500',
      borderMuted:  'border-emerald-800',
      shadow:       'shadow-emerald-500/25',
      bar:          'bg-emerald-500',
      ring:         'ring-emerald-500/30',
    },
  },
  review: {
    label: 'Review',
    color: '#f59e0b',
    tw: {
      text:         'text-amber-400',
      textBright:   'text-amber-300',
      bg:           'bg-amber-500',
      bgFaint:      'bg-amber-500/8',
      bgMuted:      'bg-amber-950',
      border:       'border-amber-500/30',
      borderBright: 'border-amber-500',
      borderMuted:  'border-amber-800',
      shadow:       'shadow-amber-500/25',
      bar:          'bg-amber-500',
      ring:         'ring-amber-500/30',
    },
  },
  bounty: {
    label: 'Bounty',
    color: '#8b5cf6',
    tw: {
      text:         'text-violet-400',
      textBright:   'text-violet-300',
      bg:           'bg-violet-500',
      bgFaint:      'bg-violet-500/8',
      bgMuted:      'bg-violet-950',
      border:       'border-violet-500/30',
      borderBright: 'border-violet-500',
      borderMuted:  'border-violet-800',
      shadow:       'shadow-violet-500/25',
      bar:          'bg-violet-500',
      ring:         'ring-violet-500/30',
    },
  },
  clarify: {
    label: 'Clarify',
    color: '#71717a',
    tw: {
      text:         'text-zinc-400',
      textBright:   'text-zinc-300',
      bg:           'bg-zinc-500',
      bgFaint:      'bg-zinc-500/8',
      bgMuted:      'bg-zinc-800',
      border:       'border-zinc-700',
      borderBright: 'border-zinc-600',
      borderMuted:  'border-zinc-700',
      shadow:       '',
      bar:          'bg-zinc-500',
      ring:         'ring-zinc-700',
    },
  },
} as const;

export type LaneKey = keyof typeof LANE_CONFIG;
export type LaneConfig = typeof LANE_CONFIG[LaneKey];

export function laneOf(raw: string): LaneKey {
  const k = raw.toLowerCase() as LaneKey;
  return k in LANE_CONFIG ? k : 'clarify';
}

export function lane(raw: string): LaneConfig {
  return LANE_CONFIG[laneOf(raw)];
}

// Surface tokens — used for card chrome
export const SURFACE = {
  base:    'bg-[#080d14] border border-white/8',
  raised:  'bg-[#0d1520] border border-white/10',
  inset:   'bg-black/20 border border-white/6',
  header:  'bg-[#080d14]/80 border-b border-white/8',
} as const;

// Typography — numbers always use tabular numerals
export const NUM = '[font-variant-numeric:tabular-nums] font-mono';
