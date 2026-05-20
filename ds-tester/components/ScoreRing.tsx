'use client';

function scoreColor(score: number) {
  if (score >= 80) return 'var(--md-success)';
  if (score >= 60) return 'var(--md-warning)';
  if (score >= 40) return 'var(--md-tertiary)';
  return 'var(--md-error)';
}

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export function ScoreRingInline({ score, size = 52, strokeWidth = 4 }: ScoreRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--md-surface-variant)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="md-label-medium" style={{ color }}>{score}</span>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score);
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Needs Work' : score >= 40 ? 'Poor' : 'Critical';
  return (
    <div className="text-right">
      <div className="font-black" style={{ fontSize: '3rem', lineHeight: 1, color }}>{score}</div>
      <div className="md-label-medium mt-0.5" style={{ color }}>{label}</div>
    </div>
  );
}
