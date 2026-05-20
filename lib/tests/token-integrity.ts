import type { FigmaFile, FigmaVariablesResponse, FigmaStyleMeta } from '../figma-client';
import type { TestResult, TestDetail } from './types';

const EXPECTED_SEMANTIC_CATEGORIES = [
  'color', 'typography', 'spacing', 'radius', 'shadow', 'motion', 'border',
];

const PRIMITIVE_PATTERNS = /^(#[0-9a-fA-F]{3,8}|\d+px|rgba?\(|hsl\(|var\(--(?!color|space|font|text|border|radius|shadow|motion))/;

export function testTokenIntegrity(
  file: FigmaFile,
  variables: FigmaVariablesResponse | null,
  styles: FigmaStyleMeta[],
): TestResult[] {
  const results: TestResult[] = [];

  // T1: Variable collections defined
  results.push(testVariableCollections(variables));

  // T2: Semantic token naming
  results.push(testSemanticNaming(variables));

  // T3: Token aliasing (tokens reference tokens, not raw values)
  results.push(testTokenAliasing(variables));

  // T4: Multi-mode / theming support
  results.push(testThemingSupport(variables));

  // T5: Style coverage
  results.push(testStyleCoverage(styles));

  // T6: Token scope definitions
  results.push(testTokenScopes(variables));

  return results;
}

function testVariableCollections(variables: FigmaVariablesResponse | null): TestResult {
  if (!variables) {
    return {
      id: 't1-collections',
      name: 'Variable Collections Defined',
      status: 'warn',
      score: 0,
      message: 'Variables API unavailable (requires Enterprise plan). Falling back to style analysis.',
      impact: 'medium',
    };
  }

  const collections = Object.values(variables.variableCollections);
  if (collections.length === 0) {
    return {
      id: 't1-collections',
      name: 'Variable Collections Defined',
      status: 'fail',
      score: 0,
      message: 'No variable collections found. Token system not implemented.',
      impact: 'critical',
    };
  }

  const details: TestDetail[] = collections.map((c) => ({
    label: c.name,
    value: `${c.variableIds.length} tokens, ${c.modes.length} mode(s): ${c.modes.map((m) => m.name).join(', ')}`,
    status: c.variableIds.length > 0 ? 'pass' : 'warn',
  }));

  return {
    id: 't1-collections',
    name: 'Variable Collections Defined',
    status: 'pass',
    score: 100,
    message: `${collections.length} collection(s) with ${Object.keys(variables.variables).length} total tokens found.`,
    details,
    impact: 'critical',
  };
}

function testSemanticNaming(variables: FigmaVariablesResponse | null): TestResult {
  if (!variables) {
    return {
      id: 't2-semantic-naming',
      name: 'Semantic Token Naming',
      status: 'skip',
      score: 50,
      message: 'Skipped — Variables API unavailable.',
      impact: 'high',
    };
  }

  const allVars = Object.values(variables.variables);
  if (allVars.length === 0) {
    return {
      id: 't2-semantic-naming',
      name: 'Semantic Token Naming',
      status: 'fail',
      score: 0,
      message: 'No variables found.',
      impact: 'high',
    };
  }

  // Check if names use semantic prefixes (color/brand/neutral etc) vs just raw names
  const semanticPrefixes = /^(color|colors|semantic|alias|brand|neutral|feedback|spacing|radius|motion|typography|text|icon|border|surface|background|bg|fg|foreground)\//i;
  const primitiveOnly = /^\d+$|^#[0-9a-f]+$/i;

  const semanticCount = allVars.filter((v) => semanticPrefixes.test(v.name)).length;
  const primitiveCount = allVars.filter((v) => primitiveOnly.test(v.name)).length;
  const score = Math.round((semanticCount / allVars.length) * 100);

  const details: TestDetail[] = EXPECTED_SEMANTIC_CATEGORIES.map((cat) => {
    const found = allVars.filter((v) => v.name.toLowerCase().startsWith(cat));
    return {
      label: cat,
      value: found.length > 0 ? `${found.length} tokens` : 'Not found',
      status: found.length > 0 ? 'pass' : 'warn',
    };
  });

  return {
    id: 't2-semantic-naming',
    name: 'Semantic Token Naming',
    status: score >= 70 ? 'pass' : score >= 40 ? 'warn' : 'fail',
    score,
    message: `${semanticCount}/${allVars.length} tokens use semantic naming. ${primitiveCount} appear to be raw primitives.`,
    details,
    impact: 'high',
  };
}

function testTokenAliasing(variables: FigmaVariablesResponse | null): TestResult {
  if (!variables) {
    return {
      id: 't3-aliasing',
      name: 'Token Aliasing (Semantic → Primitive)',
      status: 'skip',
      score: 50,
      message: 'Skipped — Variables API unavailable.',
      impact: 'high',
    };
  }

  const allVars = Object.values(variables.variables);
  if (allVars.length === 0) {
    return {
      id: 't3-aliasing',
      name: 'Token Aliasing (Semantic → Primitive)',
      status: 'fail',
      score: 0,
      message: 'No variables to analyze.',
      impact: 'high',
    };
  }

  let aliasedCount = 0;
  for (const v of allVars) {
    const values = Object.values(v.valuesByMode);
    if (values.some((val) => typeof val === 'object' && val !== null && 'type' in (val as object) && (val as { type: string }).type === 'VARIABLE_ALIAS')) {
      aliasedCount++;
    }
  }

  const score = allVars.length > 0 ? Math.round((aliasedCount / allVars.length) * 100) : 0;
  // Expect at least some aliasing if there's a semantic layer
  const expectedAliasRatio = 0.3;
  const hasAliasing = aliasedCount / allVars.length >= expectedAliasRatio;

  return {
    id: 't3-aliasing',
    name: 'Token Aliasing (Semantic → Primitive)',
    status: hasAliasing ? 'pass' : aliasedCount > 0 ? 'warn' : 'fail',
    score: hasAliasing ? 100 : Math.min(Math.round((aliasedCount / allVars.length / expectedAliasRatio) * 100), 99),
    message: `${aliasedCount}/${allVars.length} tokens reference other tokens (aliasing). ${hasAliasing ? 'Semantic layer detected.' : 'Low aliasing — components may use raw values.'}`,
    impact: 'high',
  };
}

function testThemingSupport(variables: FigmaVariablesResponse | null): TestResult {
  if (!variables) {
    return {
      id: 't4-theming',
      name: 'Multi-Mode / Theming Support',
      status: 'skip',
      score: 50,
      message: 'Skipped — Variables API unavailable.',
      impact: 'medium',
    };
  }

  const collections = Object.values(variables.variableCollections);
  const multiModeCollections = collections.filter((c) => c.modes.length > 1);
  const lightDarkCollections = collections.filter((c) =>
    c.modes.some((m) => /light|dark|day|night/i.test(m.name))
  );

  const details: TestDetail[] = collections.map((c) => ({
    label: c.name,
    value: `Modes: ${c.modes.map((m) => m.name).join(', ')}`,
    status: c.modes.length > 1 ? 'pass' : 'warn',
  }));

  const hasLightDark = lightDarkCollections.length > 0;
  const hasMultiMode = multiModeCollections.length > 0;

  return {
    id: 't4-theming',
    name: 'Multi-Mode / Theming Support',
    status: hasLightDark ? 'pass' : hasMultiMode ? 'warn' : 'fail',
    score: hasLightDark ? 100 : hasMultiMode ? 60 : 0,
    message: hasLightDark
      ? `Light/dark modes found in ${lightDarkCollections.length} collection(s).`
      : hasMultiMode
        ? `Multi-mode collections found but no explicit light/dark theming detected.`
        : 'No multi-mode collections. Theming support is missing.',
    details,
    impact: 'medium',
  };
}

function testStyleCoverage(styles: FigmaStyleMeta[]): TestResult {
  const fillStyles = styles.filter((s) => s.styleType === 'FILL');
  const textStyles = styles.filter((s) => s.styleType === 'TEXT');
  const effectStyles = styles.filter((s) => s.styleType === 'EFFECT');
  const gridStyles = styles.filter((s) => s.styleType === 'GRID');

  const hasMinimumStyles = fillStyles.length >= 5 && textStyles.length >= 3;

  const details: TestDetail[] = [
    { label: 'Color styles', value: `${fillStyles.length}`, status: fillStyles.length >= 5 ? 'pass' : fillStyles.length > 0 ? 'warn' : 'fail' },
    { label: 'Text styles', value: `${textStyles.length}`, status: textStyles.length >= 3 ? 'pass' : textStyles.length > 0 ? 'warn' : 'fail' },
    { label: 'Effect styles', value: `${effectStyles.length}`, status: effectStyles.length > 0 ? 'pass' : 'warn' },
    { label: 'Grid styles', value: `${gridStyles.length}`, status: gridStyles.length > 0 ? 'pass' : 'warn' },
  ];

  const score = Math.min(
    100,
    Math.round(
      ((fillStyles.length >= 5 ? 30 : (fillStyles.length / 5) * 30) +
        (textStyles.length >= 3 ? 30 : (textStyles.length / 3) * 30) +
        (effectStyles.length > 0 ? 20 : 0) +
        (gridStyles.length > 0 ? 20 : 0))
    )
  );

  return {
    id: 't5-style-coverage',
    name: 'Style Library Coverage',
    status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    score,
    message: `${styles.length} styles total: ${fillStyles.length} fill, ${textStyles.length} text, ${effectStyles.length} effect, ${gridStyles.length} grid.`,
    details,
    impact: 'medium',
  };
}

function testTokenScopes(variables: FigmaVariablesResponse | null): TestResult {
  if (!variables) {
    return {
      id: 't6-scopes',
      name: 'Token Scope Definitions',
      status: 'skip',
      score: 50,
      message: 'Skipped — Variables API unavailable.',
      impact: 'low',
    };
  }

  const allVars = Object.values(variables.variables);
  if (allVars.length === 0) {
    return {
      id: 't6-scopes',
      name: 'Token Scope Definitions',
      status: 'fail',
      score: 0,
      message: 'No variables to analyze.',
      impact: 'low',
    };
  }

  const scopedVars = allVars.filter((v) => v.scopes && v.scopes.length > 0 && !v.scopes.includes('ALL_SCOPES'));
  const allScopedVars = allVars.filter((v) => v.scopes && v.scopes.includes('ALL_SCOPES'));
  const unscopedVars = allVars.filter((v) => !v.scopes || v.scopes.length === 0);

  const score = Math.round((scopedVars.length / allVars.length) * 100);

  return {
    id: 't6-scopes',
    name: 'Token Scope Definitions',
    status: score >= 50 ? 'pass' : score > 0 ? 'warn' : 'fail',
    score,
    message: `${scopedVars.length} tokens have specific scopes, ${allScopedVars.length} are all-scope, ${unscopedVars.length} unscoped.`,
    details: [
      { label: 'Specifically scoped', value: `${scopedVars.length}`, status: 'pass' },
      { label: 'All-scoped (permissive)', value: `${allScopedVars.length}`, status: 'warn' },
      { label: 'Unscoped', value: `${unscopedVars.length}`, status: unscopedVars.length > 0 ? 'fail' : 'pass' },
    ],
    impact: 'low',
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void PRIMITIVE_PATTERNS;
