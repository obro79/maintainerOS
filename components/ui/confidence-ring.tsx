'use client';

import { motion } from 'framer-motion';

const R = 10;
const SW = 3;
const C = 2 * Math.PI * R; // ≈ 62.83

interface ConfidenceRingProps {
  value: number; // 0-100
  size?: number;
}

function colorFor(v: number) {
  if (v >= 85) return '#22c55e';
  if (v >= 70) return '#f59e0b';
  return '#ef4444';
}

export function ConfidenceRing({ value, size = 28 }: ConfidenceRingProps) {
  const color = colorFor(value);
  const dashLen = (value / 100) * C;

  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className="shrink-0">
      {/* Track */}
      <circle cx="14" cy="14" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
      {/* Arc */}
      <motion.circle
        cx="14" cy="14" r={R}
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeDasharray={`${dashLen} ${C}`}
        strokeDashoffset={C / 4}
        transform="rotate(-90 14 14)"
        initial={{ strokeDasharray: `0 ${C}` }}
        animate={{ strokeDasharray: `${dashLen} ${C}` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* Value */}
      <text
        x="14" y="17"
        textAnchor="middle"
        fill={color}
        fontSize="7"
        fontWeight="700"
        fontFamily="var(--font-mono)"
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </text>
    </svg>
  );
}
