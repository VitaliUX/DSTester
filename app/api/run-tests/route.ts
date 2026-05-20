import { NextRequest, NextResponse } from 'next/server';
import { FigmaClient, extractFileKey } from '@/lib/figma-client';
import { runAllTests } from '@/lib/tests/index';

/** Try fetching the file at decreasing depth until it fits. */
async function fetchFileWithFallback(client: FigmaClient, fileKey: string) {
  const depths = [4, 3, 2];
  let lastError: Error | null = null;
  for (const depth of depths) {
    try {
      return await client.getFile(fileKey, depth);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const is400 = lastError.message.includes('400');
      if (!is400) throw lastError; // non-size error — bail immediately
      // try shallower next iteration
    }
  }
  // Final fallback: depth=1 (page structure only, enough for file-level checks)
  try {
    return await client.getFileShallow(fileKey);
  } catch {
    throw lastError;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { figmaUrl: string; token: string };
  const { figmaUrl, token } = body;

  if (!figmaUrl || !token) {
    return NextResponse.json({ error: 'figmaUrl and token are required' }, { status: 400 });
  }

  const fileKey = extractFileKey(figmaUrl);
  if (!fileKey) {
    return NextResponse.json({ error: 'Invalid Figma URL or file key' }, { status: 400 });
  }

  const client = new FigmaClient(token);

  try {
    // Fetch file with automatic depth fallback for large files, plus metadata in parallel
    const [file, stylesResponse, componentsResponse] = await Promise.all([
      fetchFileWithFallback(client, fileKey),
      client.getFileStyles(fileKey).catch(() => ({ meta: { styles: [] } })),
      client.getFileComponents(fileKey).catch(() => ({ meta: { components: [] } })),
    ]);

    // Variables API requires Enterprise plan — fail gracefully
    const variables = await client.getVariables(fileKey).catch(() => null);

    const report = await runAllTests(
      file,
      variables,
      stylesResponse.meta.styles,
      componentsResponse.meta.components,
    );

    report.fileKey = fileKey;

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('403')) {
      return NextResponse.json({ error: 'Invalid token or insufficient permissions.' }, { status: 403 });
    }
    if (message.includes('404')) {
      return NextResponse.json({ error: 'File not found. Check the URL and token permissions.' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
