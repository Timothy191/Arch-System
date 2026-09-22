import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

function getAuditRoot() {
  // Using string concatenation to prevent Next.js from tracing upwards
  const staticRoot = path.normalize(process.cwd() + "/../../documentation/03-audit-reports");
  return staticRoot;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get("log") || "latest";

  const auditRoot = getAuditRoot();
  const manifestPath = path.normalize(auditRoot + "/manifest.json");

  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      manifest = [];
    }
  }

  const logDir = logId === "latest" ? path.normalize(auditRoot + "/latest") : path.normalize(auditRoot + "/" + logId);
  const targetDir = fs.existsSync(logDir) ? logDir : auditRoot;

  const readReport = (filename: string) => {
    const filePath = path.normalize(targetDir + "/" + filename);
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
