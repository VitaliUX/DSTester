import type { FigmaFile, FigmaComponentMeta, FigmaNode } from '../figma-client';
import { walkNodes } from '../figma-client';
import type { TestResult, TestDetail } from './types';

const EXPECTED_STATES = ['default', 'hover', 'focus', 'active', 'disabled', 'error', 'loading'];
const EXPECTED_SIZES = ['sm', 'md', 'lg', 'small', 'medium', 'large', 'xs', 'xl'];
const EXPECTED_THEMES = ['light', 'dark'];

interface ComponentSetInfo {
  name: string;
  variants: string[];
  properties: string[];
  hasDescription: boolean;
  documentationLinks: number;
}

export function testComponentCompleteness(
  file: FigmaFile,
  components: FigmaComponentMeta[],
): TestResult[] {
  const componentSets = extractComponentSets(file.document);

  return [
    testVariantCoverage(componentSets),
    testStateCoverage(componentSets),
    testSizeCoverage(componentSets),
    testThemeCoverage(componentSets),
    testComponentCount(components),
    testInteractiveStates(componentSets),
  ];
}

function extractComponentSets(doc: FigmaNode): ComponentSetInfo[] {
  const sets: ComponentSetInfo[] = [];

  walkNodes(doc, (node) => {
    if (node.type === 'COMPONENT_SET') {
      const propDefs = node.componentPropertyDefinitions ?? {};
      const variantProps = Object.entries(propDefs)
        .filter(([, def]) => def.type === 'VARIANT')
        .flatMap(([, def]) => def.variantOptions ?? []);

      sets.push({
        name: node.name,
        variants: variantProps,
        properties: Object.keys(propDefs),
        hasDescription: !!(node.description && node.description.trim().length > 0),
        documentationLinks: 0,
      });
    }
  });

  return sets;
}

function testVariantCoverage(sets: ComponentSetInfo[]): TestResult {
  if (sets.length === 0) {
    return {
      id: 'cc1-variant-coverage',
      name: 'Component Variant Coverage',
      status: 'warn',
      score: 30,
      message: 'No component sets found. Components may not use variants.',
      impact: 'high',
    };
  }

  const withVariants = sets.filter((s) => s.variants.length > 0);
  const score = Math.round((withVariants.length / sets.length) * 100);

  const topComponents = sets.slice(0, 10).map((s) => ({
    label: s.name,
    value: s.variants.length > 0 ? `${s.properties.length} properties, ${s.variants.length} variant values` : 'No variants',
    status: (s.variants.length > 0 ? 'pass' : 'warn') as 'pass' | 'warn',
  }));

  return {
    id: 'cc1-variant-coverage',
    name: 'Component Variant Coverage',
    status: score >= 70 ? 'pass' : score >= 40 ? 'warn' : 'fail',
    score,
    message: `${withVariants.length}/${sets.length} component sets have variant properties defined.`,
    details: topComponents,
    impact: 'high',
  };
}

function testStateCoverage(sets: ComponentSetInfo[]): TestResult {
  if (sets.length === 0) {
    return {
      id: 'cc2-state-coverage',
      name: 'Interactive State Coverage',
      status: 'warn',
      score: 30,
      message: 'No component sets to analyze for state coverage.',
      impact: 'critical',
    };
  }

  const stateMatches: Record<string, number> = {};
  for (const state of EXPECTED_STATES) {
    stateMatches[state] = sets.filter((s) =>
      s.variants.some((v) => v.toLowerCase().includes(state)) ||
      s.properties.some((p) => p.toLowerCase().includes('state') || p.toLowerCase().includes(state))
    ).length;
  }

  const coveredStates = Object.values(stateMatches).filter((n) => n > 0).length;
  const score = Math.round((coveredStates / EXPECTED_STATES.length) * 100);

  const details: TestDetail[] = EXPECTED_STATES.map((state) => ({
    label: state,
    value: stateMatches[state] > 0 ? `${stateMatches[state]} component(s)` : 'Not found',
    status: stateMatches[state] > 0 ? 'pass' : (state === 'hover' || state === 'disabled' ? 'fail' : 'warn'),
  }));

  return {
    id: 'cc2-state-coverage',
    name: 'Interactive State Coverage',
    status: score >= 70 ? 'pass' : score >= 40 ? 'warn' : 'fail',
    score,
    message: `${coveredStates}/${EXPECTED_STATES.length} interactive states detected across component library.`,
    details,
    impact: 'critical',
  };
}

function testSizeCoverage(sets: ComponentSetInfo[]): TestResult {
  if (sets.length === 0) {
    return {
      id: 'cc3-size-coverage',
      name: 'Size Variant Coverage',
      status: 'warn',
      score: 30,
      message: 'No component sets to analyze.',
      impact: 'medium',
    };
  }

  const withSizes = sets.filter((s) =>
    s.variants.some((v) => EXPECTED_SIZES.some((sz) => v.toLowerCase() === sz || v.toLowerCase().includes(sz))) ||
    s.properties.some((p) => p.toLowerCase() === 'size')
  );

  const score = sets.length > 0 ? Math.round((withSizes.length / sets.length) * 100) : 0;
  // Not all components need size variants, so 40%+ is acceptable
  const status = score >= 40 ? 'pass' : score >= 20 ? 'warn' : 'fail';

  return {
    id: 'cc3-size-coverage',
    name: 'Size Variant Coverage',
    status,
    score,
    message: `${withSizes.length}/${sets.length} component sets have size variants (sm/md/lg or equivalent).`,
    details: withSizes.slice(0, 8).map((s) => ({
      label: s.name,
      value: `Has size variants`,
      status: 'pass' as const,
    })),
    impact: 'medium',
  };
}

function testThemeCoverage(sets: ComponentSetInfo[]): TestResult {
  if (sets.length === 0) {
    return {
      id: 'cc4-theme-coverage',
      name: 'Light/Dark Theme Coverage',
      status: 'warn',
      score: 50,
      message: 'No component sets to analyze.',
      impact: 'medium',
    };
  }

  const withTheme = sets.filter((s) =>
    s.variants.some((v) => EXPECTED_THEMES.some((t) => v.toLowerCase().includes(t))) ||
    s.properties.some((p) => p.toLowerCase() === 'theme' || p.toLowerCase() === 'mode' || p.toLowerCase() === 'color-scheme')
  );

  // Theme coverage may come from variables, not variants — partial credit
  const hasAnyTheme = withTheme.length > 0;
  const score = hasAnyTheme ? Math.min(100, Math.round((withTheme.length / sets.length) * 100) + 40) : 20;

  return {
    id: 'cc4-theme-coverage',
    name: 'Light/Dark Theme Coverage',
    status: withTheme.length > 0 ? 'pass' : 'warn',
    score,
    message: withTheme.length > 0
      ? `${withTheme.length} component sets have explicit theme variants. Additional theming may come from variable modes.`
      : 'No explicit theme variants found. Theming likely relies on variable modes (check Token Integrity suite).',
    impact: 'medium',
  };
}

function testComponentCount(components: FigmaComponentMeta[]): TestResult {
  const total = components.length;
  const withDescription = components.filter((c) => c.description && c.description.trim().length > 10).length;
  const withDocs = components.filter((c) => c.documentationLinks && c.documentationLinks.length > 0).length;

  const score = total === 0 ? 0 : Math.min(100,
    (total >= 20 ? 40 : (total / 20) * 40) +
    (withDescription / Math.max(total, 1)) * 30 +
    (withDocs / Math.max(total, 1)) * 30
  );

  return {
    id: 'cc5-component-count',
    name: 'Component Library Scale',
    status: total >= 20 ? 'pass' : total >= 10 ? 'warn' : 'fail',
    score: Math.round(score),
    message: `${total} published component(s). ${withDescription} with descriptions, ${withDocs} with documentation links.`,
    details: [
      { label: 'Total components', value: `${total}`, status: total >= 20 ? 'pass' : 'warn' },
      { label: 'With descriptions', value: `${withDescription} (${total > 0 ? Math.round((withDescription / total) * 100) : 0}%)`, status: withDescription / Math.max(total, 1) >= 0.7 ? 'pass' : 'warn' },
      { label: 'With doc links', value: `${withDocs}`, status: withDocs > 0 ? 'pass' : 'warn' },
    ],
    impact: 'medium',
  };
}

function testInteractiveStates(sets: ComponentSetInfo[]): TestResult {
  const interactiveComponents = ['button', 'input', 'checkbox', 'radio', 'toggle', 'switch', 'select', 'dropdown', 'tab', 'link'];
  const found: { name: string; hasStates: boolean }[] = [];

  for (const comp of sets) {
    const nameLower = comp.name.toLowerCase();
    if (interactiveComponents.some((ic) => nameLower.includes(ic))) {
      const hasStates = comp.variants.some((v) =>
        ['hover', 'focus', 'active', 'disabled'].some((s) => v.toLowerCase().includes(s))
      );
      found.push({ name: comp.name, hasStates });
    }
  }

  if (found.length === 0) {
    return {
      id: 'cc6-interactive-states',
      name: 'Core Interactive Component States',
      status: 'warn',
      score: 50,
      message: 'No core interactive components (Button, Input, Checkbox, etc.) found by name.',
      impact: 'critical',
    };
  }

  const withStates = found.filter((f) => f.hasStates).length;
  const score = Math.round((withStates / found.length) * 100);

  return {
    id: 'cc6-interactive-states',
    name: 'Core Interactive Component States',
    status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    score,
    message: `${withStates}/${found.length} core interactive components have hover/focus/active/disabled states.`,
    details: found.map((f) => ({
      label: f.name,
      value: f.hasStates ? 'Has states' : 'Missing states',
      status: (f.hasStates ? 'pass' : 'fail') as 'pass' | 'fail',
    })),
    impact: 'critical',
  };
}
