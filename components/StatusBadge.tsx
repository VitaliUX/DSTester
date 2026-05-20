import type { TestStatus } from '@/lib/tests/types';

interface StatusBadgeProps {
  status: TestStatus;
  size?: 'sm' | 'md';
}

const LABELS: Record<TestStatus, string> = {
  pass: 'Pass',
  fail: 'Fail',
  warn: 'Warn',
  skip: 'Skip',
};

const STYLES: Record<TestStatus, { bg: string; color: string }> = {
  pass: { bg: 'var(--md-success-container)', color: 'var(--md-on-success-container)' },
  fail: { bg: 'var(--md-error-container)', color: 'var(--md-on-error-container)' },
  warn: { bg: 'var(--md-warning-container)', color: 'var(--md-on-warning-container)' },
  skip: { bg: 'var(--md-surface-variant)', color: 'var(--md-on-surface-variant)' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const s = STYLES[status];
  return (
    <span
      className="inline-flex items-center rounded-full font-medium flex-shrink-0"
      style={{
        background: s.bg,
        color: s.color,
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        fontSize: size === 'sm' ? '0.6875rem' : '0.75rem',
        letterSpacing: '0.03125rem',
      }}
    >
      {LABELS[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: TestStatus }) {
  const colors: Record<TestStatus, string> = {
    pass: 'var(--md-success)',
    fail: 'var(--md-error)',
    warn: 'var(--md-warning)',
    skip: 'var(--md-outline)',
  };
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1"
      style={{ background: colors[status] }}
    />
  );
}
