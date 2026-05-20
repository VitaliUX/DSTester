'use client';

import { useState, useRef } from 'react';
import { Play, AlertCircle, Info, ChevronDown } from 'lucide-react';
import type { TestReport } from '@/lib/tests/types';
import { TestSuiteCard } from '@/components/TestSuiteCard';
import { ReportSummary } from '@/components/ReportSummary';
import { ThemeToggle } from '@/components/ThemeProvider';

const SUITE_FILTER_OPTIONS = ['All', 'Failures', 'Warnings'] as const;
type Filter = typeof SUITE_FILTER_OPTIONS[number];


export default function Home() {
  const [figmaUrl, setFigmaUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<TestReport | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [showTokenInfo, setShowTokenInfo] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function runTests(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch('/api/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaUrl, token }),
      });
      const data = await res.json() as TestReport & { error?: string };
      if (!res.ok) { setError(data.error ?? 'Unknown error'); return; }
      setReport(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setError('Network error — make sure the dev server is running.');
    } finally {
      setLoading(false);
    }
  }

  const filteredSuites = report?.suites.filter((s) => {
    if (filter === 'Failures') return s.status === 'fail';
    if (filter === 'Warnings') return s.status === 'warn' || s.status === 'fail';
    return true;
  }) ?? [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--md-background)' }}>

      {/* ── MD3 Top App Bar ── */}
      <header
        className="sticky top-0 z-10 px-4"
        style={{
          background: 'var(--md-surface-container)',
          boxShadow: 'var(--md-shadow-1)',
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center h-16 gap-3">
          <DsLogo />
          <div className="flex-1">
            <div className="md-title-large" style={{ color: 'var(--md-on-surface)' }}>DS Tester</div>
          </div>
          <div className="flex items-center gap-1.5 md-label-medium mr-2" style={{ color: 'var(--md-on-surface-variant)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Figma API
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* ── Hero ── */}
        <div className="text-center pt-4 pb-2 space-y-3">
          <h1 className="md-display-small" style={{ color: 'var(--md-on-background)' }}>
            Test Your Design System
          </h1>
          <p className="md-body-large max-w-lg mx-auto" style={{ color: 'var(--md-on-surface-variant)' }}>
            Runs 30 automated checks across token integrity, component completeness,
            accessibility, design–code parity, and visual consistency.
          </p>
        </div>

        {/* ── Input Card ── */}
        <form onSubmit={runTests} className="space-y-4">
          <div
            className="rounded-[12px] p-6 space-y-5"
            style={{ background: 'var(--md-surface-container-low)', boxShadow: 'var(--md-shadow-1)' }}
          >
            {/* Figma URL — MD3 Outlined Text Field */}
            <OutlinedField
              label="Figma File URL"
              value={figmaUrl}
              onChange={setFigmaUrl}
              placeholder="https://www.figma.com/file/… or file key"
              type="text"
              required
            />

            {/* Token field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <OutlinedFieldLabel>Personal Access Token</OutlinedFieldLabel>
                <button
                  type="button"
                  className="flex items-center gap-1 md-label-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--md-primary)' }}
                  onClick={() => setShowTokenInfo((v) => !v)}
                >
                  <Info className="w-3.5 h-3.5" />
                  How to get a token
                  <ChevronDown
                    className="w-3.5 h-3.5 transition-transform"
                    style={{ transform: showTokenInfo ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="figd_••••••••••••••••"
                required
                className="w-full rounded-[4px] px-3 py-3 md-body-large font-mono transition-colors outline-none"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--md-outline)',
                  color: 'var(--md-on-surface)',
                  caretColor: 'var(--md-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--md-primary)', e.target.style.borderWidth = '2px')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--md-outline)', e.target.style.borderWidth = '1px')}
              />
              {showTokenInfo && (
                <div
                  className="mt-2 p-4 rounded-[12px] md-body-small space-y-2"
                  style={{ background: 'var(--md-surface-container-highest)' }}
                >
                  <p className="md-title-small" style={{ color: 'var(--md-on-surface)' }}>
                    Getting a Figma Personal Access Token
                  </p>
                  <ol className="list-decimal list-inside space-y-1 ml-1" style={{ color: 'var(--md-on-surface-variant)' }}>
                    <li>Open Figma → click your avatar → <strong>Settings</strong></li>
                    <li>Scroll to <strong>Personal access tokens</strong></li>
                    <li>Click <strong>Generate new token</strong></li>
                    <li>Set scopes: <code
                      className="px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--md-surface-variant)', color: 'var(--md-on-surface-variant)' }}
                    >File content</code> (read-only)</li>
                    <li>Copy the token — it&apos;s shown only once</li>
                  </ol>
                  <p style={{ color: 'var(--md-outline)' }}>Token is sent to the local API route only, never stored.</p>
                </div>
              )}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div
              className="flex items-start gap-3 rounded-[12px] px-4 py-3"
              style={{ background: 'var(--md-error-container)', color: 'var(--md-on-error-container)' }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="md-body-medium">{error}</p>
            </div>
          )}

          {/* MD3 Filled Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full md-label-large transition-all active:scale-[0.98]"
            style={{
              background: loading ? 'var(--md-surface-variant)' : 'var(--md-primary)',
              color: loading ? 'var(--md-on-surface-variant)' : 'var(--md-on-primary)',
              boxShadow: loading ? 'none' : 'var(--md-shadow-1)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = 'var(--md-shadow-2)'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.boxShadow = 'var(--md-shadow-1)'; }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Running tests…
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Design System Tests
              </>
            )}
          </button>
        </form>


        {/* ── Results ── */}
        {report && (
          <div ref={resultsRef} className="space-y-6">
            <ReportSummary report={report} />

            {/* Filter row */}
            <div className="flex items-center justify-between">
              <h3 className="md-title-medium" style={{ color: 'var(--md-on-surface)' }}>Test Suites</h3>
              <div
                className="flex gap-1 p-1 rounded-full"
                style={{ background: 'var(--md-surface-container-high)' }}
              >
                {SUITE_FILTER_OPTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-4 py-1.5 rounded-full md-label-medium transition-all"
                    style={
                      filter === f
                        ? { background: 'var(--md-primary)', color: 'var(--md-on-primary)' }
                        : { color: 'var(--md-on-surface-variant)', background: 'transparent' }
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredSuites.length === 0 ? (
                <div className="text-center py-12 md-body-medium" style={{ color: 'var(--md-on-surface-variant)' }}>
                  No suites match the current filter.
                </div>
              ) : (
                filteredSuites.map((suite) => <TestSuiteCard key={suite.id} suite={suite} fileKey={report.fileKey} />)
              )}
            </div>

            {/* MD3 Tonal button — test another file */}
            <button
              onClick={() => { setReport(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="w-full py-3 rounded-full md-label-large transition-all"
              style={{ background: 'var(--md-secondary-container)', color: 'var(--md-on-secondary-container)' }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--md-shadow-1)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
            >
              Test another file
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/* ── MD3 Outlined Text Field helpers ── */
function OutlinedFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="md-label-medium block mb-1.5" style={{ color: 'var(--md-on-surface-variant)' }}>
      {children}
    </label>
  );
}

function OutlinedField({
  label, value, onChange, placeholder, type = 'text', required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <OutlinedFieldLabel>{label}</OutlinedFieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-[4px] px-3 py-3 md-body-large transition-colors outline-none"
        style={{
          background: 'transparent',
          border: '1px solid var(--md-outline)',
          color: 'var(--md-on-surface)',
          caretColor: 'var(--md-primary)',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--md-primary)', e.target.style.borderWidth = '2px')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--md-outline)', e.target.style.borderWidth = '1px')}
      />
    </div>
  );
}

/* ── App logo ── */
function DsLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/favicon.ico" alt="DS Tester" width={32} height={32} className="flex-shrink-0" />
  );
}
