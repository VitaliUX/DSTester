import type { TestReport } from '@/lib/tests/types';
import { CheckCircle, XCircle, AlertTriangle, SkipForward, Clock, ExternalLink } from 'lucide-react';
import { ScoreBadge } from './ScoreRing';

interface ReportSummaryProps {
  report: TestReport;
}

function StatCard({
  label, value, icon, bg, color,
}: {
  label: string; value: number; icon: React.ReactNode; bg: string; color: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-[12px] px-4 py-3"
      style={{ background: bg }}
    >
      <span style={{ color }}>{icon}</span>
      <div>
        <div className="md-title-large font-bold" style={{ color: 'var(--md-on-surface)' }}>{value}</div>
        <div className="md-label-medium" style={{ color: 'var(--md-on-surface-variant)' }}>{label}</div>
      </div>
    </div>
  );
}

function scoreBarColor(score: number) {
  if (score >= 80) return 'var(--md-success)';
  if (score >= 60) return 'var(--md-warning)';
  if (score >= 40) return 'var(--md-tertiary)';
  return 'var(--md-error)';
}

export function ReportSummary({ report }: ReportSummaryProps) {
  const figmaUrl = `https://figma.com/file/${report.fileKey}`;

  return (
    <div className="space-y-3">
      {/* File info + overall score */}
      <div
        className="flex items-center justify-between rounded-[12px] px-6 py-5"
        style={{
          background: 'var(--md-surface-container)',
          boxShadow: 'var(--md-shadow-1)',
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="md-title-large" style={{ color: 'var(--md-on-surface)' }}>{report.fileName}</h2>
            <a
              href={figmaUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--md-primary)' }}
              className="hover:opacity-70 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="flex items-center gap-1.5 mt-1 md-body-small" style={{ color: 'var(--md-on-surface-variant)' }}>
            <Clock className="w-3 h-3" />
            <span>Tested {new Date(report.timestamp).toLocaleString()}</span>
          </div>
        </div>
        <ScoreBadge score={report.overallScore} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Passed" value={report.summary.passed}
          icon={<CheckCircle className="w-5 h-5" />}
          bg="var(--md-success-container)" color="var(--md-success)"
        />
        <StatCard
          label="Failed" value={report.summary.failed}
          icon={<XCircle className="w-5 h-5" />}
          bg="var(--md-error-container)" color="var(--md-error)"
        />
        <StatCard
          label="Warnings" value={report.summary.warned}
          icon={<AlertTriangle className="w-5 h-5" />}
          bg="var(--md-warning-container)" color="var(--md-warning)"
        />
        <StatCard
          label="Skipped" value={report.summary.skipped}
          icon={<SkipForward className="w-5 h-5" />}
          bg="var(--md-surface-variant)" color="var(--md-on-surface-variant)"
        />
      </div>

      {/* Suite score bars */}
      <div
        className="rounded-[12px] px-5 py-4 space-y-3"
        style={{ background: 'var(--md-surface-container-low)', boxShadow: 'var(--md-shadow-1)' }}
      >
        <h3 className="md-title-small mb-4" style={{ color: 'var(--md-on-surface)' }}>Suite Scores</h3>
        {report.suites.map((suite) => {
          const c = scoreBarColor(suite.score);
          return (
            <div key={suite.id} className="space-y-1.5">
              <div className="flex justify-between md-label-medium">
                <span style={{ color: 'var(--md-on-surface)' }}>{suite.name}</span>
                <span style={{ color: c }}>{suite.score}</span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--md-surface-variant)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${suite.score}%`, background: c }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
