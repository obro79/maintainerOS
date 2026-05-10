'use client';

import { motion } from 'framer-motion';

const R = 60;
const SW = 16;
const CX = 80;
const CY = 80;
const CIRCUMFERENCE = 2 * Math.PI * R;
const GAP = 4;

interface Segment {
  pct: number;
  color: string;
  label: string;
  count: number;
}

interface DonutChartProps {
  segments: Segment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}

export function DonutChart({ segments, centerValue, centerLabel, size = 160 }: DonutChartProps) {
  const renderedSegments = segments.reduce<Array<Segment & { offset: number; visLen: number }>>((acc, seg) => {
    const cumulative = acc.reduce((sum, item) => sum + (item.pct / 100) * CIRCUMFERENCE, 0);
    const segLen = (seg.pct / 100) * CIRCUMFERENCE;
    acc.push({
      ...seg,
      offset: cumulative + GAP / 2,
      visLen: Math.max(0, segLen - GAP),
    });
    return acc;
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      className="shrink-0">
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={SW}
      />

      {/* Segments */}
      <g transform={`rotate(-90 ${CX} ${CY})`}>
        {renderedSegments.map((seg, i) => {
          return (
            <motion.circle
              key={i}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={SW}
              strokeLinecap="butt"
              strokeDasharray={`${seg.visLen} ${CIRCUMFERENCE}`}
              strokeDashoffset={-seg.offset}
              initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
              animate={{ strokeDasharray: `${seg.visLen} ${CIRCUMFERENCE}` }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </g>

      {/* Center */}
      <text
        x={CX} y={CY - 8}
        textAnchor="middle"
        fill="white"
        fontSize="26"
        fontWeight="700"
        fontFamily="var(--font-heading)"
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {centerValue}
      </text>
      <text
        x={CX} y={CY + 12}
        textAnchor="middle"
        fill="#52525b"
        fontSize="10"
        fontFamily="var(--font-mono)"
        letterSpacing="0.08em">
        {centerLabel.toUpperCase()}
      </text>
    </svg>
  );
}
