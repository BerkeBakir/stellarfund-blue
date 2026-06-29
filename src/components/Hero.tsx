'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';

export default function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 p-6 sm:p-10">
      <div className="glass absolute inset-0 -z-10" />
      <div className="grid items-center gap-6 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col gap-4"
        >
          <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs opacity-80">
            {t('hero.tagline')}
          </span>
          <h1 className="text-3xl font-bold leading-tight text-gradient sm:text-4xl">
            {t('hero.title')}
          </h1>
          <p className="text-sm opacity-75">{t('hero.subtitle')}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <a
              href="#campaigns"
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white"
            >
              {t('hero.ctaExplore')}
            </a>
            <Link
              href="/create"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium"
            >
              {t('hero.ctaCreate')}
            </Link>
          </div>
        </motion.div>

        <MoneyArc />
      </div>
    </section>
  );
}

const NODES: { x: number; y: number; c: string; code: string }[] = [
  { x: 95, y: 95, c: '#f472b6', code: 'US' },
  { x: 150, y: 55, c: '#818cf8', code: 'DE' },
  { x: 205, y: 58, c: '#818cf8', code: 'TR' },
  { x: 255, y: 100, c: '#fbbf24', code: 'IN' },
  { x: 235, y: 78, c: '#a78bfa', code: 'PK' },
  { x: 262, y: 138, c: '#22d3ee', code: 'VN' },
  { x: 272, y: 165, c: '#22d3ee', code: 'ID' },
  { x: 240, y: 188, c: '#c084fc', code: 'PH' },
  { x: 215, y: 168, c: '#38bdf8', code: 'KE' },
  { x: 150, y: 172, c: '#e879f9', code: 'NG' },
  { x: 128, y: 142, c: '#34d399', code: 'GH' },
  { x: 110, y: 185, c: '#34d399', code: 'BR' },
  { x: 78, y: 140, c: '#f59e0b', code: 'MX' },
  { x: 188, y: 110, c: '#60a5fa', code: 'EG' },
];

// pairs of node indices to connect (dense network)
const LINKS: [number, number][] = [
  [1, 8], [0, 3], [12, 8], [1, 11], [3, 6], [2, 8], [0, 9],
  [13, 7], [1, 3], [11, 5], [2, 9], [0, 8], [4, 9], [13, 11],
  [10, 6], [2, 6],
];

function arcPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // bow the curve away from the globe centre (180,120)
  const dx = mx - 180;
  const dy = my - 120;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (dx / len) * 38;
  const cy = my + (dy / len) * 38;
  return `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`;
}

/** Animated cross-border money-flow network across many countries. */
function MoneyArc() {
  return (
    <motion.svg
      viewBox="0 0 360 240"
      className="h-52 w-full sm:h-72"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      <defs>
        <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="55%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="rgba(124,58,237,0.4)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* faint globe */}
      <circle cx="180" cy="120" r="110" fill="url(#glow)" />
      <g fill="none" stroke="white" strokeOpacity="0.09">
        <circle cx="180" cy="120" r="95" />
        <ellipse cx="180" cy="120" rx="40" ry="95" />
        <ellipse cx="180" cy="120" rx="72" ry="95" />
        <line x1="85" y1="120" x2="275" y2="120" />
        <path d="M100 80 Q180 55 260 80" />
        <path d="M100 160 Q180 185 260 160" />
      </g>

      {/* dense flowing links */}
      <g fill="none" stroke="url(#arc)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 8">
        {LINKS.map(([i, j], k) => (
          <path key={k} id={`hl${k}`} d={arcPath(NODES[i], NODES[j])}>
            <animate
              attributeName="stroke-dashoffset"
              values="180;0"
              dur={`${7 + (k % 6)}s`}
              repeatCount="indefinite"
            />
          </path>
        ))}
      </g>

      {/* travelling coins on a subset of links */}
      <g fill="#fde68a" stroke="#f59e0b" strokeWidth="1">
        {[0, 2, 4, 6, 9, 12, 14].map((k, idx) => (
          <circle key={k} r="3.2">
            <animateMotion dur={`${3.5 + idx * 0.6}s`} repeatCount="indefinite">
              <mpath href={`#hl${k}`} />
            </animateMotion>
          </circle>
        ))}
      </g>

      {/* country nodes */}
      {NODES.map((n) => (
        <g key={n.code}>
          <circle cx={n.x} cy={n.y} r="4.5" fill={n.c}>
            <animate attributeName="r" values="4.5;7;4.5" dur="2.8s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.9;0.35;0.9"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={n.x} cy={n.y} r="2" fill="white" />
          <text x={n.x} y={n.y - 8} textAnchor="middle" fontSize="8" fill="white" opacity="0.7">
            {n.code}
          </text>
        </g>
      ))}
    </motion.svg>
  );
}
