import type { FigmaFile, FigmaComponentMeta, FigmaNode } from '../figma-client';
import { walkNodes } from '../figma-client';
import type { TestResult, TestDetail } from './types';

// Common code naming conventions
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;

// Standard component names that should exist in mature design systems
const CORE_COMPONENTS = [
  'button', 'input', 'select', 'checkbox', 'radio', 'toggle', 'switch',
  'modal', 'dialog', 'tooltip', 'popover', 'dropdown',
  'avatar', 'badge', 'chip', 'tag',
  'card', 'list', 'table',
  'heading', 'text', 'link', 'icon',
  'spinner', 'progress', 'skeleton',
  'alert', 'toast', 'banner',
  'divider', 'spacer',
];

export function testDesignCodeParity(
  file: FigmaFile,
  components: FigmaComponentMeta[],
): TestResult[] {
  return [
    testNamingConventions(components, file.document),
    testCoreComponentCoverage(components),
    testPublishedComponents(components),
    testDescriptionQuality(components),
    testDocumentationLinks(components),
    testComponentOrganization(file.document),
  ];
}

function testNamingConventions(components: FigmaComponentMeta[], doc: FigmaNode): TestResult {
  const sets: string[] = [];
  walkNodes(doc, (node) => {
    if (node.type === 'COMPONENT_SET') sets.push(node.name);
  });

  if (sets.length === 0 && components.length === 0) {
    return {
      id: 'dcp-1-naming',
      name: 'Naming Conventions',
      status: 'warn',
      score: 30,
      message: 'No components found to analyze naming.',
      impact: 'medium',
    };
  }

  const namesToCheck = [...sets, ...components.map((c) => c.name)].slice(0, 100);

  // Check for consistent separator usage
  const usesSlash = namesToCheck.filter((n) => n.includes('/')).length;
  const usesDot = namesToCheck.filter((n) => n.includes('.')).length;
  const usesUnderscore = namesToCheck.filter((n) => n.includes('_')).length;

  const slashRatio = usesSlash / namesToCheck.length;
  const hasConsistentSeparator = slashRatio > 0.5 || usesDot / namesToCheck.length > 0.5;

  // Check for Figma-specific naming: "Component/Variant" or "Type/Component"
  const figmaConvention = namesToCheck.filter((n) => n.includes('/')).length;
  const figmaConventionScore = Math.round((figmaConvention / namesToCheck.length) * 100);

  // Check for PascalCase component names
  const rootNames = namesToCheck.map((n) => n.split('/')[0].trim());
  const pascalCount = rootNames.filter((n) => PASCAL_CASE.test(n)).length;
  const kebabCount = rootNames.filter((n) => KEBAB_CASE.test(n.replace(/\s/g, '-').toLowerCase())).length;

  const details: TestDetail[] = [
    { label: 'Use "/" grouping', value: `${usesSlash}/${namesToCheck.length}`, status: slashRatio > 0.3 ? 'pass' : 'warn' },
    { label: 'PascalCase root names', value: `${pascalCount}/${namesToCheck.length}`, status: pascalCount / namesToCheck.length > 0.5 ? 'pass' : 'warn' },
    { label: 'Consistent separator', value: hasConsistentSeparator ? 'Yes' : 'Mixed', status: hasConsistentSeparator ? 'pass' : 'warn' },
    { label: 'Underscore usage (avoid)', value: `${usesUnderscore}`, status: usesUnderscore === 0 ? 'pass' : 'warn' },
  ];

  const score = Math.round(
    (slashRatio > 0.3 ? 25 : slashRatio * 25 / 0.3) +
    (pascalCount / namesToCheck.length >= 0.5 ? 25 : pascalCount / namesToCheck.length * 50) +
    (hasConsistentSeparator ? 25 : 10) +
    (usesUnderscore === 0 ? 25 : Math.max(0, 25 - (usesUnderscore / namesToCheck.length) * 25))
  );

  return {
    id: 'dcp-1-naming',
    name: 'Naming Conventions',
    status: score >= 70 ? 'pass' : score >= 45 ? 'warn' : 'fail',
    score,
    message: `Naming analysis: ${slashRatio > 0.3 ? 'Consistent "/" grouping' : 'Inconsistent grouping'}, ${pascalCount > namesToCheck.length * 0.5 ? 'PascalCase' : 'mixed case'} root names.`,
    details,
    impact: 'medium',
  };

  void KEBAB_CASE;
  void CAMEL_CASE;
}

function testCoreComponentCoverage(components: FigmaComponentMeta[]): TestResult {
  const names = components.map((c) => c.name.toLowerCase());
  const found: string[] = [];
  const missing: string[] = [];

  for (const core of CORE_COMPONENTS) {
    if (names.some((n) => n.includes(core))) {
      found.push(core);
    } else {
      missing.push(core);
    }
  }

  const score = Math.round((found.length / CORE_COMPONENTS.length) * 100);

  // Tier coverage
  const tier1 = ['button', 'input', 'modal', 'avatar', 'card', 'heading', 'text', 'icon'];
  const tier1Found = tier1.filter((t) => found.includes(t));

  const details: TestDetail[] = [
    { label: 'Tier 1 (essential)', value: `${tier1Found.length}/${tier1.length}: ${tier1Found.join(', ')}`, status: tier1Found.length >= 6 ? 'pass' : 'warn' },
    { label: 'Total coverage', value: `${found.length}/${CORE_COMPONENTS.length}`, status: score >= 60 ? 'pass' : 'warn' },
    { label: 'Missing', value: missing.slice(0, 8).join(', '), status: 'warn' },
  ];

  return {
    id: 'dcp-2-core-coverage',
    name: 'Core Component Coverage',
    status: score >= 60 ? 'pass' : score >= 35 ? 'warn' : 'fail',
    score,
    message: `${found.length}/${CORE_COMPONENTS.length} core components found. Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}.`,
    details,
    impact: 'high',
  };
}

function testPublishedComponents(components: FigmaComponentMeta[]): TestResult {
  if (components.length === 0) {
    return {
      id: 'dcp-3-published',
      name: 'Component Publishing',
      status: 'fail',
      score: 0,
      message: 'No published components found. Components must be published to the library to be shareable.',
      impact: 'critical',
    };
  }

  const remoteComponents = components.filter((c) => c.remote);
  const localComponents = components.filter((c) => !c.remote);

  return {
    id: 'dcp-3-published',
    name: 'Component Publishing',
    status: components.length > 0 ? 'pass' : 'fail',
    score: components.length > 0 ? 100 : 0,
    message: `${components.length} published components. ${localComponents.length} local, ${remoteComponents.length} from external libraries.`,
    details: [
      { label: 'Published components', value: `${components.length}`, status: 'pass' },
      { label: 'From external libs', value: `${remoteComponents.length}`, status: 'pass' },
    ],
    impact: 'critical',
  };
}

function testDescriptionQuality(components: FigmaComponentMeta[]): TestResult {
  if (components.length === 0) {
    return {
      id: 'dcp-4-descriptions',
      name: 'Component Description Quality',
      status: 'fail',
      score: 0,
      message: 'No components to analyze.',
      impact: 'medium',
    };
  }

  const noDescription = components.filter((c) => !c.description || c.description.trim().length === 0);
  const shortDescription = components.filter((c) => c.description && c.description.trim().length > 0 && c.description.trim().length < 30);
  const goodDescription = components.filter((c) => c.description && c.description.trim().length >= 30);

  const score = Math.round((goodDescription.length / components.length) * 100);

  return {
    id: 'dcp-4-descriptions',
    name: 'Component Description Quality',
    status: score >= 70 ? 'pass' : score >= 40 ? 'warn' : 'fail',
    score,
    message: `${goodDescription.length}/${components.length} components have meaningful descriptions (30+ chars).`,
    details: [
      { label: 'Good descriptions', value: `${goodDescription.length}`, status: 'pass' },
      { label: 'Too short', value: `${shortDescription.length}`, status: 'warn' },
      { label: 'No description', value: `${noDescription.length}`, status: noDescription.length > 0 ? 'fail' : 'pass' },
    ],
    impact: 'medium',
  };
}

function testDocumentationLinks(components: FigmaComponentMeta[]): TestResult {
  if (components.length === 0) {
    return {
      id: 'dcp-5-doc-links',
      name: 'Documentation Links',
      status: 'warn',
      score: 30,
      message: 'No components to check.',
      impact: 'medium',
    };
  }

  const withLinks = components.filter((c) => c.documentationLinks && c.documentationLinks.length > 0);
  const score = Math.round((withLinks.length / components.length) * 100);

  const sampleLinks = withLinks.slice(0, 3).flatMap((c) => c.documentationLinks.map((l) => l.uri));

  return {
    id: 'dcp-5-doc-links',
    name: 'Documentation Links',
    status: score >= 50 ? 'pass' : score >= 20 ? 'warn' : 'fail',
    score,
    message: `${withLinks.length}/${components.length} components have external documentation links.`,
    details: sampleLinks.slice(0, 4).map((uri) => ({
      label: 'Link found',
      value: uri.substring(0, 60),
      status: 'pass' as const,
    })),
    impact: 'medium',
  };
}

function testComponentOrganization(doc: FigmaNode): TestResult {
  const pages: string[] = [];
  const sections: string[] = [];

  // Top-level children of document are pages
  if (doc.children) {
    for (const page of doc.children) {
      pages.push(page.name);
      // First-level frames within pages
      if (page.children) {
        for (const frame of page.children) {
          if (frame.type === 'FRAME' || frame.type === 'SECTION') {
            sections.push(frame.name);
          }
        }
      }
    }
  }

  const hasComponentsPage = pages.some((p) => /component|library|design system|ds|ui kit/i.test(p));
  const hasFoundationsPage = pages.some((p) => /foundation|token|color|typography|spacing/i.test(p));
  const hasDocumentationPage = pages.some((p) => /doc|guide|usage|example|pattern/i.test(p));
  const hasChangelog = pages.some((p) => /changelog|release|version|history/i.test(p));

  const score =
    (hasComponentsPage ? 35 : 0) +
    (hasFoundationsPage ? 30 : 0) +
    (hasDocumentationPage ? 20 : 0) +
    (hasChangelog ? 15 : 0);

  const details: TestDetail[] = [
    { label: 'Components/Library page', value: hasComponentsPage ? 'Found' : 'Missing', status: hasComponentsPage ? 'pass' : 'fail' },
    { label: 'Foundations/Tokens page', value: hasFoundationsPage ? 'Found' : 'Missing', status: hasFoundationsPage ? 'pass' : 'warn' },
    { label: 'Documentation/Usage page', value: hasDocumentationPage ? 'Found' : 'Missing', status: hasDocumentationPage ? 'pass' : 'warn' },
    { label: 'Changelog page', value: hasChangelog ? 'Found' : 'Missing', status: hasChangelog ? 'pass' : 'warn' },
    { label: 'Pages found', value: pages.join(', '), status: 'pass' },
  ];

  return {
    id: 'dcp-6-organization',
    name: 'File Organization',
    status: score >= 65 ? 'pass' : score >= 35 ? 'warn' : 'fail',
    score,
    message: `File has ${pages.length} page(s): ${pages.join(', ')}.`,
    details,
    impact: 'low',
  };
}
