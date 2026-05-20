'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Palette, Layers, Eye, Code2, Ruler } from 'lucide-react';
import type { TestSuite, TestResult } from '@/lib/tests/types';
import { StatusBadge, StatusDot } from './StatusBadge';
import { ScoreRingInline } from './ScoreRing';

const ICONS: Record<string, React.ReactNode> = {
  palette: <Palette className="w-[18px] h-[18px]" />,
  layers: <Layers className="w-[18px] h-[18px]" />,
  eye: <Eye className="w-[18px] h-[18px]" />,
  code: <Code2 className="w-[18px] h-[18px]" />,
  ruler: <Ruler className="w-[18px] h-[18px]" />,
};

const IMPACT_ORDER = { critical: 0, high: 1, medium: 2, low: 3, undefined: 4 };

function ImpactChip({ impact }: { impact?: string }) {
  if (!impact) return null;
  const styles: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'var(--md-error-container)', color: 'var(--md-on-error-container)' },
    high: { bg: 'var(--md-tertiary-container)', color: 'var(--md-on-tertiary-container)' },
    medium: { bg: 'var(--md-secondary-container)', color: 'var(--md-on-secondary-container)' },
    low: { bg: 'var(--md-surface-variant)', color: 'var(--md-on-surface-variant)' },
  };
  const s = styles[impact] ?? styles.low;
  return (
    <span
      className="inline-flex items-center rounded-full md-label-small px-2 py-0.5 flex-shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      {impact}
    </span>
  );
}

function TestResultRow({ test }: { test: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = test.details && test.details.length > 0;

  return (
    <div style={{ borderBottom: '1px solid var(--md-outline-variant)' }} className="last:border-0">
      <button
        className="w-full flex items-start gap-3 px-5 py-3 text-left transition-colors"
        style={{ color: 'var(--md-on-surface)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--md-on-surface) 6%, transparent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        onClick={() => hasDetails && setExpanded((e) => !e)}
      >
        <StatusDot status={test.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="md-title-small" style={{ color: 'var(--md-on-surface)' }}>{test.name}</span>
            <ImpactChip impact={test.impact} />
          </div>
          <p className="md-body-small mt-0.5 leading-relaxed" style={{ color: 'var(--md-on-surface-variant)' }}>
            {test.message}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          <StatusBadge status={test.status} />
          {hasDetails && (
            expanded
              ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--md-on-surface-variant)' }} />
              : <ChevronRight className="w-4 h-4" style={{ color: 'var(--md-on-surface-variant)' }} />
          )}
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="px-5 pb-3 pl-10">
          <div
            className="rounded-xl overflow-hidden md-body-small"
            style={{ border: '1px solid var(--md-outline-variant)', background: 'var(--md-surface-container-low)' }}
          >
            {test.details!.map((detail, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-2.5"
                style={{ borderBottom: i < test.details!.length - 1 ? '1px solid var(--md-outline-variant)' : undefined }}
              >
                {detail.status && <StatusDot status={detail.status} />}
                <span className="font-medium min-w-[140px] flex-shrink-0" style={{ color: 'var(--md-on-surface)' }}>
                  {detail.label}
                </span>
                <span className="break-all" style={{ color: 'var(--md-on-surface-variant)' }}>{detail.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TestSuiteCard({ suite }: { suite: TestSuite }) {
  const [open, setOpen] = useState(true);
  const sortedTests = [...suite.tests].sort(
    (a, b) => (IMPACT_ORDER[a.impact ?? 'undefined'] - IMPACT_ORDER[b.impact ?? 'undefined'])
  );

  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{
        background: 'var(--md-surface-container-low)',
        boxShadow: 'var(--md-shadow-1)',
      }}
    >
      {/* Suite header */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--md-on-surface) 6%, transparent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        onClick={() => setOpen((o) => !o)}
      >
        {/* Icon in tonal container */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}
        >
          {ICONS[suite.icon] ?? <Palette className="w-[18px] h-[18px]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="md-title-medium" style={{ color: 'var(--md-on-surface)' }}>{suite.name}</span>
            <StatusBadge status={suite.status} />
          </div>
          <p className="md-body-small mt-0.5 truncate" style={{ color: 'var(--md-on-surface-variant)' }}>
            {suite.description}
          </p>
        </div>
        <ScoreRingInline score={suite.score} size={52} strokeWidth={4} />
        {open
          ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--md-on-surface-variant)' }} />
          : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--md-on-surface-variant)' }} />
        }
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--md-outline-variant)' }}>
          {sortedTests.map((test) => <TestResultRow key={test.id} test={test} />)}
        </div>
      )}
    </div>
  );
}
