export interface FigmaFile {
  document: FigmaNode;
  components: Record<string, FigmaComponentMeta>;
  componentSets: Record<string, FigmaComponentSetMeta>;
  styles: Record<string, FigmaStyleMeta>;
  name: string;
  lastModified: string;
  version: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: FigmaFill[];
  strokes?: FigmaFill[];
  style?: FigmaTextStyle;
  componentPropertyDefinitions?: Record<string, ComponentPropertyDef>;
  description?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  constraints?: unknown;
  opacity?: number;
  effects?: unknown[];
  layoutMode?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  boundVariables?: Record<string, BoundVariable | BoundVariable[]>;
}

export interface FigmaFill {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  gradientStops?: Array<{ color: { r: number; g: number; b: number; a: number } }>;
  boundVariables?: Record<string, BoundVariable>;
}

export interface BoundVariable {
  type: 'VARIABLE_ALIAS';
  id: string;
}

export interface FigmaTextStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
  textAlignHorizontal?: string;
}

export interface ComponentPropertyDef {
  type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';
  defaultValue: string | boolean;
  variantOptions?: string[];
}

export interface FigmaComponentMeta {
  key: string;
  name: string;
  description: string;
  remote: boolean;
  documentationLinks: Array<{ uri: string }>;
}

export interface FigmaComponentSetMeta {
  key: string;
  name: string;
  description: string;
  remote: boolean;
  documentationLinks: Array<{ uri: string }>;
}

export interface FigmaStyleMeta {
  key: string;
  name: string;
  description: string;
  remote: boolean;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variableIds: string[];
  defaultModeId: string;
}

export interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, unknown>;
  scopes: string[];
  codeSyntax: Record<string, string>;
  description: string;
  hiddenFromPublishing: boolean;
}

export interface FigmaVariablesResponse {
  variables: Record<string, FigmaVariable>;
  variableCollections: Record<string, FigmaVariableCollection>;
}

export interface FigmaComponentsResponse {
  meta: {
    components: FigmaComponentMeta[];
  };
}

export class FigmaClient {
  private baseUrl = 'https://api.figma.com/v1';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async fetch<T>(path: string): Promise<T> {
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      headers: { 'X-Figma-Token': this.token },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Figma API error ${res.status}: ${err}`);
    }
    return res.json() as Promise<T>;
  }

  /** Fetch file at limited depth to avoid 400 "request too large" on big files. */
  async getFile(fileKey: string, depth = 4): Promise<FigmaFile> {
    return this.fetch<FigmaFile>(`/files/${fileKey}?depth=${depth}`);
  }

  /** Fetch just the page/document structure (depth=1) to get page names. */
  async getFileShallow(fileKey: string): Promise<FigmaFile> {
    return this.fetch<FigmaFile>(`/files/${fileKey}?depth=1`);
  }

  /** Fetch nodes for a specific page by nodeId (depth-limited). */
  async getFileNodes(fileKey: string, nodeIds: string[], depth = 4): Promise<{
    nodes: Record<string, { document: FigmaNode }>;
  }> {
    const ids = nodeIds.join(',');
    return this.fetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}&depth=${depth}`);
  }

  async getFileComponents(fileKey: string): Promise<FigmaComponentsResponse> {
    return this.fetch<FigmaComponentsResponse>(`/files/${fileKey}/components`);
  }

  async getVariables(fileKey: string): Promise<FigmaVariablesResponse> {
    return this.fetch<FigmaVariablesResponse>(`/files/${fileKey}/variables/local`);
  }

  async getFileStyles(fileKey: string): Promise<{ meta: { styles: FigmaStyleMeta[] } }> {
    return this.fetch(`/files/${fileKey}/styles`);
  }
}

export function extractFileKey(urlOrKey: string): string {
  const match = urlOrKey.match(/\/(?:file|design)\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : urlOrKey;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const sRGB = [r, g, b].map((c) => {
    const v = c;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function walkNodes(node: FigmaNode, visitor: (n: FigmaNode) => void): void {
  visitor(node);
  if (node.children) {
    for (const child of node.children) {
      walkNodes(child, visitor);
    }
  }
}
