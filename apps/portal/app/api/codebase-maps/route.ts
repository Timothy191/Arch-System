import fs from 'node:fs';
import path from 'node:path';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { NextResponse } from 'next/server';

// AGENT-TRACE: Statically scoped to the repo-root codebase-maps folder so
// Turbopack NFT does not trace the whole project. The mapsRoot option is
// kept for tests; in production it defaults to the resolved repo root.
// Using string concatenation to completely hide the path resolution from
// the Next.js Node File Trace (NFT) static analyzer.
const DEFAULT_MAPS_ROOT = path.normalize(`${process.cwd()}/../../codebase-maps`);

// Only flat, human-authored map files are servable. The leading character
// must be alphanumeric, which makes `..`, hidden files, and absolute paths
// impossible; slashes are excluded entirely.
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isSafeSegment(value: string): boolean {
  return SAFE_SEGMENT.test(value) && !value.includes('..');
}

/**
 * Resolves `segments` beneath `root` and returns null when the resolved path
 * escapes it. This is defence in depth on top of the allowlist above.
 */
function resolveWithin(root: string, ...segments: string[]): string | null {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  return candidate;
}

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message, code: 'INVALID_REQUEST' },
    { status: 400 }
  );
}

export async function GET(request: Request, options?: { mapsRoot?: string }) {
  // The auth proxy excludes /api/*; every route handler must authenticate itself.
  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized access', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const mapsRoot = options?.mapsRoot ?? DEFAULT_MAPS_ROOT;
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get('log') || 'latest';
  const fileKey = searchParams.get('file') || 'route-feature-architecture.md';

  if (logId !== 'latest' && !isSafeSegment(logId)) {
    return badRequest('Invalid log identifier');
  }
  if (!isSafeSegment(fileKey) || !fileKey.endsWith('.md')) {
    return badRequest('Invalid map file name');
  }

  const manifestPath = resolveWithin(mapsRoot, 'manifest.json');
  if (!manifestPath) {
    return badRequest('Invalid maps root');
  }

  let manifest: unknown[] = [];
  if (fs.existsSync(/*turbopackIgnore: true*/ manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ manifestPath, 'utf-8'));
    } catch {
      manifest = [];
    }
  }

  const requestedDir = resolveWithin(mapsRoot, logId);
  if (!requestedDir) {
    return badRequest('Invalid log identifier');
  }

  const candidatePath = resolveWithin(requestedDir, fileKey);
  const fallbackPath = resolveWithin(mapsRoot, fileKey);
  const filePath =
    candidatePath && fs.existsSync(/*turbopackIgnore: true*/ candidatePath)
      ? candidatePath
      : fallbackPath;
  if (!filePath) {
    return badRequest('Invalid map file name');
  }

  let mapContent = '';
  if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    mapContent = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8');
  } else {
    mapContent = `# ${fileKey}\n\nMap content unavailable.`;
  }

  return NextResponse.json({
    manifest,
    activeLogId: logId,
    activeFileKey: fileKey,
    content: mapContent,
  });
}
