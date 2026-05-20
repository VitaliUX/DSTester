import type { FigmaFile, FigmaNode, FigmaVariablesResponse } from '../figma-client';
import { walkNodes, relativeLuminance, contrastRatio, rgbToHex } from '../figma-client';
import type { TestResult, TestDetail } from './types';

const isDeprecated = (name: string) => /deprecated/i.test(name);

const MIN_CONTRAST_AA_NORMAL = 4.5;
const MIN_CONTRAST_AA_LARGE = 3.0;
const MIN_CONTRAST_AAA_NORMAL = 7.0;
const MIN_TOUCH_TARGET_PX = 44;
const MIN_FONT_SIZE_BODY = 14;

interface ColorPair {
  text: { r: number; g: number; b: number };
  background: { r: number; g: number; b: number };
  fontSize?: number;
  context: string;
  nodeId: string;
}

export function testAccessibility(
  file: FigmaFile,
  variables: FigmaVariablesResponse | null,
): TestResult[] {
  const colorPairs = extractColorPairs(file.document);

  return [
    testColorContrast(colorPairs),
    testTextSizes(file.document),
    testTouchTargets(file.document),
    testFocusIndicators(file.document),
    testMotionTokens(variables),
    testAriaAnnotations(file.document),
  ];
}

function componentContext(node: FigmaNode): string {
  const propDefs = node.componentPropertyDefinitions ?? {};
  const variantParts = Object.entries(propDefs)
    .filter(([, def]) => def.type === 'VARIANT')
    .map(([key, def]) => `${key}=${def.defaultValue}`)
    .join(', ');
  return variantParts ? `${node.name} [${variantParts}]` : node.name;
}

function extractColorPairs(doc: FigmaNode): ColorPair[] {
  const pairs: ColorPair[] = [];

  function walk(node: FigmaNode, ancestor: string) {
    const isComponent = node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE';
    if (isComponent && isDeprecated(node.name)) return;
    const ctx = isComponent ? componentContext(node) : ancestor;

    if (node.type === 'TEXT' && node.fills?.length && node.absoluteBoundingBox) {
      const textFill = node.fills.find((f) => f.type === 'SOLID' && f.color);
      if (textFill?.color) {
        pairs.push({
          text: textFill.color,
          background: { r: 1, g: 1, b: 1 },
          fontSize: node.style?.fontSize,
          context: ctx || node.name || 'text',
          nodeId: node.id,
        });
      }
    }

    for (const child of node.children ?? []) walk(child, ctx);
  }

  walk(doc, '');
  return pairs.slice(0, 100);
}

function testColorContrast(pairs: ColorPair[]): TestResult {
  if (pairs.length === 0) {
    return {
      id: 'a11y-1-contrast',
      name: 'Color Contrast (WCAG AA)',
      status: 'warn',
      score: 50,
      message: 'No text-on-background pairs found. Ensure components use solid fills for accurate analysis.',
      impact: 'critical',
    };
  }

  const results: Array<{ pass: boolean; ratio: number; hex: string; context: string; nodeId: string }> = [];

  for (const pair of pairs) {
    const textLum = relativeLuminance(pair.text.r, pair.text.g, pair.text.b);
    const bgLum = relativeLuminance(pair.background.r, pair.background.g, pair.background.b);
    const ratio = contrastRatio(textLum, bgLum);
    const isLargeText = (pair.fontSize ?? 0) >= 18 || ((pair.fontSize ?? 0) >= 14);
    const threshold = isLargeText ? MIN_CONTRAST_AA_LARGE : MIN_CONTRAST_AA_NORMAL;
    results.push({
      pass: ratio >= threshold,
      ratio: Math.round(ratio * 100) / 100,
      hex: rgbToHex(pair.text.r, pair.text.g, pair.text.b),
      context: pair.context,
      nodeId: pair.nodeId,
    });
  }

  const passing = results.filter((r) => r.pass).length;
  const score = Math.round((passing / results.length) * 100);
  const failures = results.filter((r) => !r.pass).slice(0, 5);

  const details: TestDetail[] = failures.map((f) => ({
    label: f.context,
    value: `${f.hex} · ratio ${f.ratio}:1 on white`,
    status: 'fail' as const,
    nodeId: f.nodeId,
  }));

  if (details.length < 5) {
    details.push({
      label: 'Note',
      value: 'Analysis uses white (#fff) as default background. For accurate results, test with actual backgrounds.',
      status: 'warn',
    });
  }

  return {
    id: 'a11y-1-contrast',
    name: 'Color Contrast (WCAG AA)',
    status: score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'fail',
    score,
    message: `${passing}/${results.length} text nodes pass WCAG AA contrast. Note: uses white background approximation.`,
    details,
    impact: 'critical',
  };
}

function testTextSizes(doc: FigmaNode): TestResult {
  const textNodes: Array<{ name: string; size: number }> = [];

  walkNodes(doc, (node) => {
    if (node.type === 'TEXT' && node.style?.fontSize) {
      textNodes.push({ name: node.name || 'text', size: node.style.fontSize });
    }
  });

  if (textNodes.length === 0) {
    return {
      id: 'a11y-2-text-sizes',
      name: 'Minimum Text Size',
      status: 'warn',
      score: 50,
      message: 'No text nodes found.',
      impact: 'high',
    };
  }

  const tooSmall = textNodes.filter((t) => t.size < MIN_FONT_SIZE_BODY);
  const score = Math.round((1 - tooSmall.length / textNodes.length) * 100);

  const sizeDistribution = textNodes.reduce((acc, t) => {
    const bucket = `${Math.floor(t.size / 4) * 4}px+`;
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const details: TestDetail[] = Object.entries(sizeDistribution)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([size, count]) => ({
      label: size,
      value: `${count} nodes`,
      status: (parseInt(size) >= MIN_FONT_SIZE_BODY ? 'pass' : 'warn') as 'pass' | 'warn',
    }));

  return {
    id: 'a11y-2-text-sizes',
    name: 'Minimum Text Size',
    status: score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'fail',
    score,
    message: `${tooSmall.length}/${textNodes.length} text nodes are below ${MIN_FONT_SIZE_BODY}px minimum.`,
    details,
    impact: 'high',
  };
}

function testTouchTargets(doc: FigmaNode): TestResult {
  const interactiveNodes: Array<{ name: string; w: number; h: number; nodeId: string }> = [];
  const INTERACTIVE_TYPES = ['button', 'input', 'checkbox', 'radio', 'toggle', 'switch', 'tab', 'link', 'chip', 'icon-button'];

  walkNodes(doc, (node) => {
    const nameLower = node.name.toLowerCase();
    if (
      (node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
      INTERACTIVE_TYPES.some((t) => nameLower.includes(t)) &&
      node.absoluteBoundingBox &&
      !isDeprecated(node.name)
    ) {
      interactiveNodes.push({
        name: node.name,
        w: node.absoluteBoundingBox.width,
        h: node.absoluteBoundingBox.height,
        nodeId: node.id,
      });
    }
  });

  if (interactiveNodes.length === 0) {
    return {
      id: 'a11y-3-touch-targets',
      name: 'Touch Target Size (44×44px min)',
      status: 'warn',
      score: 50,
      message: 'No interactive components found by name convention.',
      impact: 'high',
    };
  }

  const failing = interactiveNodes.filter(
    (n) => n.w < MIN_TOUCH_TARGET_PX || n.h < MIN_TOUCH_TARGET_PX
  );
  const score = Math.round(((interactiveNodes.length - failing.length) / interactiveNodes.length) * 100);

  return {
    id: 'a11y-3-touch-targets',
    name: 'Touch Target Size (44×44px min)',
    status: score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'fail',
    score,
    message: `${failing.length}/${interactiveNodes.length} interactive components are below 44×44px touch target minimum.`,
    details: failing.slice(0, 6).map((n) => ({
      label: n.name,
      value: `${Math.round(n.w)}×${Math.round(n.h)}px`,
      status: 'fail' as const,
      nodeId: n.nodeId,
    })),
    impact: 'high',
  };
}

function testFocusIndicators(doc: FigmaNode): TestResult {
  const hasFocusComponents: Array<{ name: string; nodeId: string }> = [];
  const missingFocusComponents: Array<{ name: string; nodeId: string }> = [];

  walkNodes(doc, (node) => {
    if (node.type !== 'COMPONENT_SET' || isDeprecated(node.name)) return;
    const nameLower = node.name.toLowerCase();
    const isInteractive = ['button', 'input', 'checkbox', 'radio', 'toggle', 'link', 'tab'].some((t) => nameLower.includes(t));
    if (!isInteractive) return;

    const propDefs = node.componentPropertyDefinitions ?? {};
    const hasFocusVariant = Object.values(propDefs).some((def) =>
      def.type === 'VARIANT' && def.variantOptions?.some((v) => v.toLowerCase().includes('focus'))
    );

    if (hasFocusVariant) {
      hasFocusComponents.push({ name: node.name, nodeId: node.id });
    } else {
      missingFocusComponents.push({ name: node.name, nodeId: node.id });
    }
  });

  const total = hasFocusComponents.length + missingFocusComponents.length;

  if (total === 0) {
    return {
      id: 'a11y-4-focus',
      name: 'Focus State Indicators',
      status: 'warn',
      score: 50,
      message: 'No interactive components found to check for focus states.',
      impact: 'critical',
    };
  }

  const score = Math.round((hasFocusComponents.length / total) * 100);

  return {
    id: 'a11y-4-focus',
    name: 'Focus State Indicators',
    status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    score,
    message: `${hasFocusComponents.length}/${total} interactive components have explicit focus state variants.`,
    details: [
      ...hasFocusComponents.slice(0, 4).map((n) => ({ label: n.name, value: 'Focus state ✓', status: 'pass' as const, nodeId: n.nodeId })),
      ...missingFocusComponents.slice(0, 4).map((n) => ({ label: n.name, value: 'No focus state', status: 'fail' as const, nodeId: n.nodeId })),
    ],
    impact: 'critical',
  };
}

function testMotionTokens(variables: FigmaVariablesResponse | null): TestResult {
  if (!variables) {
    return {
      id: 'a11y-5-motion',
      name: 'Reduced Motion Support',
      status: 'skip',
      score: 50,
      message: 'Skipped — Variables API unavailable. Verify motion tokens exist in your token system.',
      impact: 'medium',
    };
  }

  const allVars = Object.values(variables.variables);
  const motionVars = allVars.filter((v) =>
    /motion|animation|duration|easing|transition/i.test(v.name)
  );
  const reducedMotionVars = motionVars.filter((v) =>
    /reduced|none|instant|0ms/i.test(v.name) ||
    Object.values(v.valuesByMode).some((val) => val === 0 || val === '0ms' || val === 'none')
  );

  if (motionVars.length === 0) {
    return {
      id: 'a11y-5-motion',
      name: 'Reduced Motion Support',
      status: 'warn',
      score: 30,
      message: 'No motion/animation tokens found. Ensure your system has motion tokens with a reduced-motion mode.',
      impact: 'medium',
    };
  }

  return {
    id: 'a11y-5-motion',
    name: 'Reduced Motion Support',
    status: reducedMotionVars.length > 0 ? 'pass' : 'warn',
    score: reducedMotionVars.length > 0 ? 100 : 50,
    message: `${motionVars.length} motion tokens found. ${reducedMotionVars.length > 0 ? 'Reduced-motion variants detected.' : 'No reduced-motion variants — add a "reduced motion" mode to motion token collection.'}`,
    details: motionVars.slice(0, 5).map((v) => ({
      label: v.name,
      value: Object.values(v.valuesByMode)[0] as string ?? 'n/a',
      status: 'pass' as const,
    })),
    impact: 'medium',
  };
}

function testAriaAnnotations(doc: FigmaNode): TestResult {
  // In Figma, ARIA annotations appear as specific annotation nodes or in component descriptions
  // We check for annotation-style frames and description content
  const annotatedComponents: string[] = [];
  let annotationFrameCount = 0;

  walkNodes(doc, (node) => {
    if ((node.type === 'COMPONENT_SET' || node.type === 'COMPONENT') && !isDeprecated(node.name)) {
      const desc = (node.description ?? '').toLowerCase();
      if (
        desc.includes('aria') ||
        desc.includes('role=') ||
        desc.includes('accessible') ||
        desc.includes('screen reader') ||
        desc.includes('keyboard')
      ) {
        annotatedComponents.push(node.name);
      }
    }
    // Figma accessibility annotations use specific frame names
    if (node.name.toLowerCase().includes('annotation') || node.name.toLowerCase().includes('a11y')) {
      annotationFrameCount++;
    }
  });

  const hasAnnotations = annotatedComponents.length > 0 || annotationFrameCount > 0;

  return {
    id: 'a11y-6-aria',
    name: 'Accessibility Annotations',
    status: hasAnnotations ? 'pass' : 'warn',
    score: hasAnnotations ? Math.min(100, (annotatedComponents.length + annotationFrameCount) * 10 + 40) : 20,
    message: hasAnnotations
      ? `${annotatedComponents.length} components with ARIA/a11y in descriptions, ${annotationFrameCount} annotation frames found.`
      : 'No accessibility annotations found. Consider using Figma\'s Accessibility Annotation Kit.',
    details: [
      { label: 'Components with a11y descriptions', value: `${annotatedComponents.length}`, status: annotatedComponents.length > 0 ? 'pass' : 'warn' },
      { label: 'Annotation frames', value: `${annotationFrameCount}`, status: annotationFrameCount > 0 ? 'pass' : 'warn' },
    ],
    impact: 'high',
  };
}
