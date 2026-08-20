import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

function getAuditRoot() {
  let current = process.cwd();
  while (current !== "/" && current !== path.dirname(current)) {
    const candidate = path.join(current, "documentation", "03-audit-reports");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "../../documentation/03-audit-reports");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get("log") || "latest";

  const auditRoot = getAuditRoot();
  const manifestPath = path.join(auditRoot, "manifest.json");

  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      manifest = [];
    }
  }

  const logDir = logId === "latest" ? path.join(auditRoot, "latest") : path.join(auditRoot, logId);
  const targetDir = fs.existsSync(logDir) ? logDir : auditRoot;

  const readReport = (filename: string) => {
    const filePath = path.join(targetDir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return `# ${filename}\n\nReport unavailable.`;
  };

  return NextResponse.json({
    manifest,
    activeLogId: logId,
    results: readReport("results.md"),
    requiredActions: readReport("required-actions.md"),
    designReport: readReport("design-report.md"),
    rlsReport: readReport("rls-report.md"),
  });
}
