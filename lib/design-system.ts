// MaintainerOS Design System
// The four routing lanes are the primary design language.
// All color decisions derive from LANE_CONFIG.

export const LANE_CONFIG = {
  agent: {
    label: 'AI',
    color: '#3F72AF',
    tw: {
      text:         'text-[#3F72AF]',
      textBright:   'text-[#F9F7F7]',
      bg:           'bg-[#3F72AF]',
      bgFaint:      'bg-[#3F72AF]/10',
      bgMuted:      'bg-[#3F72AF]/18',
      border:       'border-[#3F72AF]/35',
      borderBright: 'border-[#3F72AF]',
      borderMuted:  'border-[#3F72AF]/20',
      shadow:       'shadow-[#3F72AF]/20',
      bar:          'bg-[#3F72AF]',
      ring:         'ring-[#3F72AF]/30',
    },
  },
  review: {
    label: 'DEV',
    color: '#DBE2EF',
    tw: {
      text:         'text-[#DBE2EF]',
      textBright:   'text-[#DBE2EF]',
      bg:           'bg-[#DBE2EF]',
      bgFaint:      'bg-[#DBE2EF]/12',
      bgMuted:      'bg-[#DBE2EF]/18',
      border:       'border-[#DBE2EF]/30',
      borderBright: 'border-[#DBE2EF]',
      borderMuted:  'border-[#DBE2EF]/22',
      shadow:       'shadow-[#DBE2EF]/15',
      bar:          'bg-[#DBE2EF]',
      ring:         'ring-[#DBE2EF]/25',
    },
  },
  bounty: {
    label: 'CLUSTLY',
    color: '#112D4E',
    tw: {
      text:         'text-[#DBE2EF]',
      textBright:   'text-[#DBE2EF]',
      bg:           'bg-[#112D4E]',
      bgFaint:      'bg-[#112D4E]/16',
      bgMuted:      'bg-[#112D4E]/24',
      border:       'border-[#112D4E]/45',
      borderBright: 'border-[#112D4E]',
      borderMuted:  'border-[#112D4E]/28',
      shadow:       'shadow-[#112D4E]/20',
      bar:          'bg-[#112D4E]',
      ring:         'ring-[#112D4E]/30',
    },
  },
  clarify: {
    label: 'Clarify',
    color: '#F9F7F7',
    tw: {
      text:         'text-[#F9F7F7]/70',
      textBright:   'text-[#F9F7F7]',
      bg:           'bg-[#F9F7F7]/45',
      bgFaint:      'bg-[#F9F7F7]/7',
      bgMuted:      'bg-[#F9F7F7]/10',
      border:       'border-[#F9F7F7]/14',
      borderBright: 'border-[#F9F7F7]/30',
      borderMuted:  'border-[#F9F7F7]/14',
      shadow:       '',
      bar:          'bg-[#F9F7F7]/45',
      ring:         'ring-[#F9F7F7]/20',
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
  base:    'bg-[#0A111A] border border-[#F9F7F7]/12',
  raised:  'bg-[#0D1724] border border-[#F9F7F7]/16',
  inset:   'bg-black/25 border border-[#F9F7F7]/10',
  header:  'bg-[#0A111A]/85 border-b border-[#F9F7F7]/12',
} as const;

// Typography — numbers always use tabular numerals
export const NUM = '[font-variant-numeric:tabular-nums] font-mono';
