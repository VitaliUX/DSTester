import type { FigmaFile, FigmaVariablesResponse, FigmaStyleMeta } from '../figma-client';
import type { TestResult, TestDetail } from './types';

// Semantic keywords accepted anywhere in a slash/dot/dash/underscore-separated token path
const SEMANTIC_KEYWORDS = /^(colou?rs?|semantic|alias|brand|neutral|feedback|spacing|space|radius|motion|duration|typography|text|font|icon|border|surface|background|bg|fg|foreground|elevation|shadow|size|scale|primitive|global|sys|ref)$/i;

function hasSemanticSegment(name: string): boolean {
  return name.split(/[/.\-_]/).some((seg) => SEMANTIC_KEYWORDS.test(seg));
}

const EXPECTED_SEMANTIC_CATEGORIES = [
  'color', 'typography', 'spacing', 'radius', 'shadow', 'motion', 'border',
];

export function testTokenIntegrity(
  file: FigmaFile,
  variables: FigmaVariablesResponse | null,
  styles: FigmaStyleMeta[],
): TestResult[] {
  return [
    testVariableCollections(variables),
    testSemanticNaming(variables),
    testTokenAliasing(variables),
    testThemingSupport(variables),
    testStyleCoverage(styles, variables),
    testTokenScopes(variables),
  ];
}

// T1
function testVariableCollections(variables: FigmaVariablesResponse | null): TestResult {
  if (!variables) {
    return {
      id: 't1-collections',
      name: 'Variable Collections Defined',
      status: 'warn',
      score: 50, // neutral — plan limitation, not a DS failure
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

// T2
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

  const semanticCount = allVars.filter((v) => hasSemanticSegment(v.name)).length;
  const primitiveOnly = /^\d+$|^#[0-9a-f]+$/i;
  const primitiveCount = allVars.filter((v) => primitiveOnly.test(v.name)).length;
  const score = Math.round((semanticCount / allVars.length) * 100);

  const details: TestDetail[] = EXPECTED_SEMANTIC_CATEGORIES.map((cat) => {
    const found = allVars.filter((v) =>
      v.name.split(/[/.\-_]/).some((seg) => seg.toLowerCase() === cat || seg.toLowerCase() === cat + 's')
    );
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

// T3
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

  const ratio = aliasedCount / allVars.length;
  const score = Math.round(ratio * 100);

  return {
    id: 't3-aliasing',
    name: 'Token Aliasing (Semantic → Primitive)',
    status: ratio >= 0.3 ? 'pass' : ratio >= 0.05 ? 'warn' : 'fail',
    score,
    message: `${aliasedCount}/${allVars.length} tokens reference other tokens (aliasing). ${ratio >= 0.3 ? 'Semantic layer detected.' : ratio >= 0.05 ? 'Partial aliasing — consider a semantic layer over primitives.' : 'No aliasing — components likely use raw values directly.'}`,
    impact: 'high',
  };
}

// T4
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
    // Any multi-mode = pass; light/dark names = bonus detail only
    status: hasMultiMode ? 'pass' : 'fail',
    score: hasLightDark ? 100 : hasMultiMode ? 80 : 0,
    message: hasLightDark
      ? `Light/dark modes found in ${lightDarkCollections.length} collection(s).`
      : hasMultiMode
        ? `${multiModeCollections.length} multi-mode collection(s) found. No explicit light/dark names detected — modes may use custom naming.`
        : 'No multi-mode collections. Theming support is missing.',
    details,
    impact: 'medium',
  };
}

// T5
function testStyleCoverage(styles: FigmaStyleMeta[], variables: FigmaVariablesResponse | null): TestResult {
  const fillStyles = styles.filter((s) => s.styleType === 'FILL');
  const textStyles = styles.filter((s) => s.styleType === 'TEXT');
  const effectStyles = styles.filter((s) => s.styleType === 'EFFECT');
  const gridStyles = styles.filter((s) => s.styleType === 'GRID');

  const hasVariables = variables !== null && Object.keys(variables.variableCollections).length > 0;
  const noStyles = styles.length === 0;

  // If the team uses Variables, absence of Styles is expected (modern approach)
  if (noStyles && hasVariables) {
    return {
      id: 't5-style-coverage',
      name: 'Style Library Coverage',
      status: 'warn',
      score: 60,
      message: 'No published styles found. Team appears to use Variables (modern approach) — consider publishing text and effect styles alongside tokens.',
      details: [
        { label: 'Color styles', value: '0 (using Variables)', status: 'warn' },
        { label: 'Text styles', value: '0 (using Variables)', status: 'warn' },
        { label: 'Effect styles', value: '0', status: 'warn' },
        { label: 'Grid styles', value: '0', status: 'warn' },
      ],
      impact: 'medium',
    };
  }

  const details: TestDetail[] = [
    { label: 'Color styles', value: `${fillStyles.length}`, status: fillStyles.length >= 5 ? 'pass' : fillStyles.length > 0 ? 'warn' : 'fail' },
    { label: 'Text styles', value: `${textStyles.length}`, status: textStyles.length >= 3 ? 'pass' : textStyles.length > 0 ? 'warn' : 'fail' },
    { label: 'Effect styles', value: `${effectStyles.length}`, status: effectStyles.length > 0 ? 'pass' : 'warn' },
    { label: 'Grid styles', value: `${gridStyles.length}`, status: gridStyles.length > 0 ? 'pass' : 'warn' },
  ];

  const score = Math.min(100, Math.round(
    (fillStyles.length >= 5 ? 30 : (fillStyles.length / 5) * 30) +
    (textStyles.length >= 3 ? 30 : (textStyles.length / 3) * 30) +
    (effectStyles.length > 0 ? 20 : 0) +
    (gridStyles.length > 0 ? 20 : 0)
  ));

  return {
    id: 't5-style-coverage',
    name: 'Style Library Coverage',
    status: score >= 80 ? 'pass' : score >= 40 ? 'warn' : 'fail',
    score,
    message: `${styles.length} styles total: ${fillStyles.length} fill, ${textStyles.length} text, ${effectStyles.length} effect, ${gridStyles.length} grid.`,
    details,
    impact: 'medium',
  };
}

// T6
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

  // ALL_SCOPES is intentional and valid — count it as well-scoped
  const wellScopedVars = allVars.filter((v) => v.scopes && v.scopes.length > 0);
  const specificScopedVars = allVars.filter((v) => v.scopes && v.scopes.length > 0 && !v.scopes.includes('ALL_SCOPES'));
  const unscopedVars = allVars.filter((v) => !v.scopes || v.scopes.length === 0);

  const score = Math.round((wellScopedVars.length / allVars.length) * 100);

  return {
    id: 't6-scopes',
    name: 'Token Scope Definitions',
    status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    score,
    message: `${specificScopedVars.length} tokens have specific scopes, ${wellScopedVars.length - specificScopedVars.length} use ALL_SCOPES, ${unscopedVars.length} unscoped.`,
    details: [
      { label: 'Specifically scoped', value: `${specificScopedVars.length}`, status: specificScopedVars.length > 0 ? 'pass' : 'warn' },
      { label: 'All-scoped', value: `${wellScopedVars.length - specificScopedVars.length}`, status: 'pass' },
      { label: 'Unscoped', value: `${unscopedVars.length}`, status: unscopedVars.length > 0 ? 'fail' : 'pass' },
    ],
    impact: 'low',
  };
}
