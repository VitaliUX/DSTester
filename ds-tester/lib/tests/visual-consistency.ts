import type { FigmaFile, FigmaNode, FigmaVariablesResponse } from '../figma-client';
import { walkNodes, rgbToHex } from '../figma-client';
import type { TestResult, TestDetail } from './types';

const SPACING_SCALE_4 = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
const SPACING_SCALE_8 = [8, 16, 24, 32, 40, 48, 64, 80, 96, 128];
const RADIUS_SCALE = [0, 2, 4, 6, 8, 12, 16, 24, 9999];

export function testVisualConsistency(
  file: FigmaFile,
  variables: FigmaVariablesResponse | null,
): TestResult[] {
  return [
    testSpacingConsistency(file.document, variables),
    testColorConsistency(file.document, variables),
    testTypographyConsistency(file.document),
    testRadiusConsistency(file.document, variables),
    testIconConsistency(file.document),
    testGridConsistency(file.document),
  ];
}

function testSpacingConsistency(doc: FigmaNode, variables: FigmaVariablesResponse | null): TestResult {
  const spacingValues: number[] = [];

  walkNodes(doc, (node) => {
    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      const vals = [
        node.paddingLeft, node.paddingRight, node.paddingTop, node.paddingBottom, node.itemSpacing,
      ].filter((v): v is number => v !== undefined && v > 0);
      spacingValues.push(...vals);
    }
  });

  if (spacingValues.length === 0) {
    return {
      id: 'vc-1-spacing',
      name: 'Spacing Scale Consistency',
      status: 'warn',
      score: 50,
      message: 'No auto-layout spacing found. Ensure components use auto-layout.',
      impact: 'medium',
    };
  }

  const uniqueValues = [...new Set(spacingValues)].sort((a, b) => a - b);
  const onScale4 = uniqueValues.filter((v) => SPACING_SCALE_4.includes(v) || v % 4 === 0).length;
  const onScale8 = uniqueValues.filter((v) => SPACING_SCALE_8.includes(v) || v % 8 === 0).length;
  const offScale = uniqueValues.filter((v) => v % 4 !== 0 && v % 8 !== 0).length;

  const score4 = Math.round((onScale4 / uniqueValues.length) * 100);
  const isOnScale = score4 >= 70;

  const offScaleValues = uniqueValues.filter((v) => v % 4 !== 0);

  const details: TestDetail[] = [
    { label: 'Unique spacing values', value: uniqueValues.slice(0, 10).join(', ') + (uniqueValues.length > 10 ? '…' : ''), status: 'pass' },
    { label: 'On 4px scale', value: `${onScale4}/${uniqueValues.length}`, status: score4 >= 70 ? 'pass' : 'warn' },
    { label: 'On 8px scale', value: `${onScale8}/${uniqueValues.length}`, status: onScale8 / uniqueValues.length >= 0.5 ? 'pass' : 'warn' },
    { label: 'Off-scale values', value: offScaleValues.slice(0, 5).join(', ') || 'None', status: offScale === 0 ? 'pass' : 'warn' },
  ];

  if (variables) {
    const spacingVars = Object.values(variables.variables).filter((v) =>
      /spacing|space|gap|padding|margin/i.test(v.name)
    );
    details.push({ label: 'Spacing tokens', value: `${spacingVars.length}`, status: spacingVars.length > 0 ? 'pass' : 'warn' });
  }

  return {
    id: 'vc-1-spacing',
    name: 'Spacing Scale Consistency',
    status: isOnScale ? 'pass' : score4 >= 40 ? 'warn' : 'fail',
    score: score4,
    message: `${onScale4}/${uniqueValues.length} spacing values align to 4px grid. ${offScaleValues.length} off-scale values found.`,
    details,
    impact: 'medium',
  };
}

function testColorConsistency(doc: FigmaNode, variables: FigmaVariablesResponse | null): TestResult {
  const rawColors: string[] = [];
  const boundColors: string[] = [];

  walkNodes(doc, (node) => {
    if (!node.fills) return;
    for (const fill of node.fills) {
      if (fill.type !== 'SOLID' || !fill.color) continue;
      if (fill.boundVariables?.color) {
        boundColors.push(rgbToHex(fill.color.r, fill.color.g, fill.color.b));
      } else {
        rawColors.push(rgbToHex(fill.color.r, fill.color.g, fill.color.b));
      }
    }
  });

  const total = rawColors.length + boundColors.length;
  if (total === 0) {
    return {
      id: 'vc-2-colors',
      name: 'Color Token Usage',
      status: 'warn',
      score: 50,
      message: 'No solid fills found to analyze.',
      impact: 'high',
    };
  }

  const boundRatio = boundColors.length / total;
  const score = Math.round(boundRatio * 100);
  const uniqueRaw = [...new Set(rawColors)];

  const details: TestDetail[] = [
    { label: 'Token-bound fills', value: `${boundColors.length} (${Math.round(boundRatio * 100)}%)`, status: boundRatio >= 0.7 ? 'pass' : 'warn' },
    { label: 'Raw/hardcoded fills', value: `${rawColors.length}`, status: rawColors.length === 0 ? 'pass' : 'fail' },
    { label: 'Unique raw colors', value: uniqueRaw.slice(0, 6).join(', '), status: uniqueRaw.length === 0 ? 'pass' : 'warn' },
  ];

  if (variables) {
    const colorVars = Object.values(variables.variables).filter((v) => v.resolvedType === 'COLOR');
    details.push({ label: 'Color tokens defined', value: `${colorVars.length}`, status: colorVars.length > 0 ? 'pass' : 'fail' });
  }

  return {
    id: 'vc-2-colors',
    name: 'Color Token Usage',
    status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    score,
    message: `${boundColors.length}/${total} fills are bound to color tokens. ${uniqueRaw.length} unique raw colors detected.`,
    details,
    impact: 'high',
  };
}

function testTypographyConsistency(doc: FigmaNode): TestResult {
  const fontFamilies: string[] = [];
  const fontSizes: number[] = [];
  const fontWeights: number[] = [];

  walkNodes(doc, (node) => {
    if (node.type === 'TEXT' && node.style) {
      if (node.style.fontFamily) fontFamilies.push(node.style.fontFamily);
      if (node.style.fontSize) fontSizes.push(node.style.fontSize);
      if (node.style.fontWeight) fontWeights.push(node.style.fontWeight);
    }
  });

  if (fontFamilies.length === 0) {
    return {
      id: 'vc-3-typography',
      name: 'Typography Consistency',
      status: 'warn',
      score: 50,
      message: 'No text nodes found.',
      impact: 'high',
    };
  }

  const uniqueFamilies = [...new Set(fontFamilies)];
  const uniqueSizes = [...new Set(fontSizes)].sort((a, b) => a - b);
  const uniqueWeights = [...new Set(fontWeights)].sort((a, b) => a - b);

  const hasTooManyFamilies = uniqueFamilies.length > 3;
  const hasModularScale = checkModularScale(uniqueSizes);

  const score =
    (uniqueFamilies.length <= 2 ? 40 : uniqueFamilies.length <= 3 ? 25 : 10) +
    (hasModularScale ? 30 : 15) +
    (uniqueSizes.length >= 4 && uniqueSizes.length <= 12 ? 30 : 15);

  const details: TestDetail[] = [
    { label: 'Font families', value: uniqueFamilies.join(', '), status: hasTooManyFamilies ? 'fail' : 'pass' },
    { label: 'Font sizes', value: uniqueSizes.join(', '), status: 'pass' },
    { label: 'Font weights', value: uniqueWeights.join(', '), status: 'pass' },
    { label: 'Scale consistency', value: hasModularScale ? 'Consistent scale' : 'Irregular sizes', status: hasModularScale ? 'pass' : 'warn' },
  ];

  return {
    id: 'vc-3-typography',
    name: 'Typography Consistency',
    status: score >= 70 ? 'pass' : score >= 45 ? 'warn' : 'fail',
    score,
    message: `${uniqueFamilies.length} font family(ies), ${uniqueSizes.length} unique sizes, ${uniqueWeights.length} weights.${hasTooManyFamilies ? ' Too many font families.' : ''}`,
    details,
    impact: 'high',
  };
}

function checkModularScale(sizes: number[]): boolean {
  if (sizes.length < 3) return true;
  // Check if sizes roughly follow a pattern (all divisible by base, or consistent ratio)
  const base = sizes[0];
  return sizes.every((s) => s % 2 === 0) || sizes.every((s) => Math.round(s / base) === s / base);
}

function testRadiusConsistency(doc: FigmaNode, variables: FigmaVariablesResponse | null): TestResult {
  const radiusValues: number[] = [];

  walkNodes(doc, (node) => {
    if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
      radiusValues.push(node.cornerRadius);
    }
  });

  if (radiusValues.length === 0) {
    return {
      id: 'vc-4-radius',
      name: 'Border Radius Consistency',
      status: 'warn',
      score: 50,
      message: 'No border radius values found.',
      impact: 'low',
    };
  }

  const uniqueValues = [...new Set(radiusValues)].sort((a, b) => a - b);
  const onScale = uniqueValues.filter((v) => RADIUS_SCALE.includes(v)).length;
  const score = Math.round((onScale / uniqueValues.length) * 100);

  let radiusVarCount = 0;
  if (variables) {
    radiusVarCount = Object.values(variables.variables).filter((v) =>
      /radius|corner|rounded/i.test(v.name)
    ).length;
  }

  return {
    id: 'vc-4-radius',
    name: 'Border Radius Consistency',
    status: score >= 70 ? 'pass' : score >= 40 ? 'warn' : 'fail',
    score,
    message: `${uniqueValues.length} unique radius values found. ${onScale}/${uniqueValues.length} on standard scale.`,
    details: [
      { label: 'Radius values', value: uniqueValues.slice(0, 8).join(', '), status: 'pass' },
      { label: 'Radius tokens', value: `${radiusVarCount}`, status: radiusVarCount > 0 ? 'pass' : 'warn' },
    ],
    impact: 'low',
  };
}

function testIconConsistency(doc: FigmaNode): TestResult {
  const iconNodes: Array<{ name: string; w: number; h: number }> = [];

  walkNodes(doc, (node) => {
    const nameLower = node.name.toLowerCase();
    if (
      (node.type === 'COMPONENT' || node.type === 'FRAME') &&
      (nameLower.includes('icon') || nameLower.startsWith('ic-') || nameLower.startsWith('ic/')) &&
      node.absoluteBoundingBox
    ) {
      iconNodes.push({
        name: node.name,
        w: Math.round(node.absoluteBoundingBox.width),
        h: Math.round(node.absoluteBoundingBox.height),
      });
    }
  });

  if (iconNodes.length === 0) {
    return {
      id: 'vc-5-icons',
      name: 'Icon Set Consistency',
      status: 'warn',
      score: 50,
      message: 'No icon components found (looking for nodes named "icon", "ic-", "ic/").',
      impact: 'medium',
    };
  }

  const sizes = iconNodes.map((i) => `${i.w}×${i.h}`);
  const uniqueSizes = [...new Set(sizes)];
  const squareIcons = iconNodes.filter((i) => i.w === i.h).length;
  const standardSizes = iconNodes.filter((i) => [16, 20, 24, 32, 48].includes(i.w) && i.w === i.h).length;

  const score =
    (squareIcons / iconNodes.length >= 0.9 ? 40 : Math.round((squareIcons / iconNodes.length) * 40)) +
    (standardSizes / iconNodes.length >= 0.8 ? 40 : Math.round((standardSizes / iconNodes.length) * 40)) +
    (uniqueSizes.length <= 4 ? 20 : 10);

  const details: TestDetail[] = [
    { label: 'Total icons', value: `${iconNodes.length}`, status: 'pass' },
    { label: 'Square icons', value: `${squareIcons}/${iconNodes.length}`, status: squareIcons / iconNodes.length >= 0.9 ? 'pass' : 'warn' },
    { label: 'Standard sizes (16/20/24/32/48)', value: `${standardSizes}`, status: standardSizes > 0 ? 'pass' : 'warn' },
    { label: 'Size variants', value: uniqueSizes.join(', '), status: uniqueSizes.length <= 4 ? 'pass' : 'warn' },
  ];

  return {
    id: 'vc-5-icons',
    name: 'Icon Set Consistency',
    status: score >= 70 ? 'pass' : score >= 40 ? 'warn' : 'fail',
    score,
    message: `${iconNodes.length} icon components. ${squareIcons} square, ${standardSizes} at standard sizes.`,
    details,
    impact: 'medium',
  };
}

function testGridConsistency(doc: FigmaNode): TestResult {
  let frameCount = 0;
  let framesWithLayout = 0;
  const layoutModes: string[] = [];

  walkNodes(doc, (node) => {
    if (node.type === 'COMPONENT' || node.type === 'FRAME') {
      frameCount++;
      if (node.layoutMode && node.layoutMode !== 'NONE') {
        framesWithLayout++;
        layoutModes.push(node.layoutMode);
      }
    }
  });

  if (frameCount === 0) {
    return {
      id: 'vc-6-layout',
      name: 'Auto-Layout Adoption',
      status: 'warn',
      score: 50,
      message: 'No frames found.',
      impact: 'medium',
    };
  }

  const score = Math.round((framesWithLayout / frameCount) * 100);
  const horizontalCount = layoutModes.filter((m) => m === 'HORIZONTAL').length;
  const verticalCount = layoutModes.filter((m) => m === 'VERTICAL').length;

  return {
    id: 'vc-6-layout',
    name: 'Auto-Layout Adoption',
    status: score >= 60 ? 'pass' : score >= 30 ? 'warn' : 'fail',
    score,
    message: `${framesWithLayout}/${frameCount} frames use auto-layout (${Math.round((framesWithLayout / frameCount) * 100)}%).`,
    details: [
      { label: 'Auto-layout adoption', value: `${score}%`, status: score >= 60 ? 'pass' : 'warn' },
      { label: 'Horizontal stacks', value: `${horizontalCount}`, status: 'pass' },
      { label: 'Vertical stacks', value: `${verticalCount}`, status: 'pass' },
    ],
    impact: 'medium',
  };
}
