import type { FigmaFile, FigmaVariablesResponse, FigmaStyleMeta, FigmaComponentMeta } from '../figma-client';
import { testTokenIntegrity } from './token-integrity';
import { testComponentCompleteness } from './component-completeness';
import { testAccessibility } from './accessibility';
import { testDesignCodeParity } from './design-code-parity';
import { testVisualConsistency } from './visual-consistency';
import type { TestReport, TestSuite, TestResult, TestStatus } from './types';

function suiteScore(results: TestResult[]): number {
  if (results.length === 0) return 0;
  const applicable = results.filter((r) => r.status !== 'skip');
  if (applicable.length === 0) return 50;
  return Math.round(applicable.reduce((sum, r) => sum + r.score, 0) / applicable.length);
}

function suiteStatus(results: TestResult[]): TestStatus {
  if (results.some((r) => r.status === 'fail' && r.impact === 'critical')) return 'fail';
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'warn')) return 'warn';
  if (results.every((r) => r.status === 'pass' || r.status === 'skip')) return 'pass';
  return 'warn';
}

export async function runAllTests(
  file: FigmaFile,
  variables: FigmaVariablesResponse | null,
  styles: FigmaStyleMeta[],
  components: FigmaComponentMeta[],
): Promise<TestReport> {
  const suites: TestSuite[] = [
    {
      id: 'token-integrity',
      name: 'Token Integrity',
      description: 'Validates that design tokens are properly structured, semantically named, and correctly aliased.',
      icon: 'palette',
      tests: testTokenIntegrity(file, variables, styles),
      score: 0,
      status: 'pass',
    },
    {
      id: 'component-completeness',
      name: 'Component Completeness',
      description: 'Checks variant coverage, interactive states, size options, and theme support across all components.',
      icon: 'layers',
      tests: testComponentCompleteness(file, components),
      score: 0,
      status: 'pass',
    },
    {
      id: 'accessibility',
      name: 'Accessibility',
      description: 'WCAG 2.2 AA compliance: color contrast, text sizes, touch targets, focus states, and motion tokens.',
      icon: 'eye',
      tests: testAccessibility(file, variables),
      score: 0,
      status: 'pass',
    },
    {
      id: 'design-code-parity',
      name: 'Design–Code Parity',
      description: 'Checks naming conventions, core component coverage, publishing, and documentation quality.',
      icon: 'code',
      tests: testDesignCodeParity(file, components),
      score: 0,
      status: 'pass',
    },
    {
      id: 'visual-consistency',
      name: 'Visual Consistency',
      description: 'Spacing scale adherence, color token usage, typography consistency, radius patterns, and auto-layout.',
      icon: 'ruler',
      tests: testVisualConsistency(file, variables),
      score: 0,
      status: 'pass',
    },
  ];

  // Calculate suite-level scores
  for (const suite of suites) {
    suite.score = suiteScore(suite.tests);
    suite.status = suiteStatus(suite.tests);
  }

  const allTests = suites.flatMap((s) => s.tests);
  const passed = allTests.filter((t) => t.status === 'pass').length;
  const failed = allTests.filter((t) => t.status === 'fail').length;
  const warned = allTests.filter((t) => t.status === 'warn').length;
  const skipped = allTests.filter((t) => t.status === 'skip').length;

  const overallScore = Math.round(suites.reduce((sum, s) => sum + s.score, 0) / suites.length);

  return {
    fileKey: '',
    fileName: file.name,
    timestamp: new Date().toISOString(),
    overallScore,
    suites,
    summary: {
      passed,
      failed,
      warned,
      skipped,
      total: allTests.length,
    },
  };
}

export type { TestReport, TestSuite, TestResult, TestStatus };
