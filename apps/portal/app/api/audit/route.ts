import fs from 'node:fs';
import path from 'node:path';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { NextResponse } from 'next/server';

// Flat log directory names only. The first character must be alphanumeric, so
// `..`, hidden directories, and absolute paths are rejected outright.
const SAFE_LOG_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function getAuditRoot() {
  // Using string concatenation to prevent Next.js from tracing upwards
  const staticRoot = path.normalize(`${process.cwd()}/../../documentation/03-audit-reports`);
  return staticRoot;
}

function isWithin(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const prefix = `${resolvedRoot}${path.sep || '/'}`;
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(prefix);
}

export async function GET(request: Request) {
  // The auth proxy excludes /api/*; every route handler must authenticate itself.
  const principal = await getAuthenticatedEmployee();
  if (!principal) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized access', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const logId = searchParams.get('log') || 'latest';

  if (logId !== 'latest' && !SAFE_LOG_ID.test(logId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid log identifier', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  const auditRoot = getAuditRoot();
  const manifestPath = path.normalize(`${auditRoot}/manifest.json`);

  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      manifest = [];
    }
  }

  const logDir =
    logId === 'latest'
      ? path.normalize(`${auditRoot}/latest`)
      : path.normalize(`${auditRoot}/${logId}`);

  if (!isWithin(auditRoot, logDir)) {
    return NextResponse.json(
      { success: false, error: 'Invalid log identifier', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  const targetDir = fs.existsSync(logDir) ? logDir : auditRoot;

  const readReport = (filename: string) => {
    const filePath = path.normalize(`${targetDir}/${filename}`);
    if (!isWithin(auditRoot, filePath)) {
      return `# ${filename}\n\nReport unavailable.`;
    }
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return `# ${filename}\n\nReport unavailable.`;
  };

  return NextResponse.json({
    manifest,
    activeLogId: logId,
    results: readReport('results.md'),
    requiredActions: readReport('required-actions.md'),
    designReport: readReport('design-report.md'),
    rlsReport: readReport('rls-report.md'),
  });
}
