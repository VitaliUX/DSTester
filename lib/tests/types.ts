export type TestStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  score: number; // 0-100
  message: string;
  details?: TestDetail[];
  impact?: 'critical' | 'high' | 'medium' | 'low';
}

export interface TestDetail {
  label: string;
  value: string;
  status?: TestStatus;
  nodeId?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  icon: string;
  tests: TestResult[];
  score: number;
  status: TestStatus;
}

export interface TestReport {
  fileKey: string;
  fileName: string;
  timestamp: string;
  overallScore: number;
  suites: TestSuite[];
  summary: {
    passed: number;
    failed: number;
    warned: number;
    skipped: number;
    total: number;
  };
}
