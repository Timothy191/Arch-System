import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

// AGENT-TRACE: Statically scoped to the repo-root codebase-maps folder so
// Turbopack NFT does not trace the whole project. The mapsRoot option is
// kept for tests; in production it defaults to the resolved repo root.
// Using string concatenation to completely hide the path resolution from
// the Next.js Node File Trace (NFT) static analyzer.
const DEFAULT_MAPS_ROOT = path.normalize(process.cwd() + "/../../codebase-maps");

export const dynamic = "force-dynamic";

export async function GET(request: Request, options?: { mapsRoot?: string }) {
  const mapsRoot = options?.mapsRoot ?? DEFAULT_MAPS_ROOT;
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get("log") || "latest";
  const fileKey = searchParams.get("file") || "route-feature-architecture.md";

  const manifestPath = path.normalize(mapsRoot + "/manifest.json");

  let manifest: unknown[] = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      manifest = [];
    }
  }

  const targetDir =
    logId === "latest"
      ? path.normalize(mapsRoot + "/latest")
      : path.normalize(mapsRoot + "/" + logId);
  const fallbackDir = fs.existsSync(targetDir) ? targetDir : mapsRoot;
  const filePath = path.normalize(fallbackDir + "/" + fileKey);

  let mapContent = "";
  if (fs.existsSync(filePath)) {
    mapContent = fs.readFileSync(filePath, "utf-8");
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
