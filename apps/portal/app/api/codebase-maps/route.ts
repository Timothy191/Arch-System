import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export function getMapsRoot() {
  const portalRoot = process.cwd();
  const mapsInPortal = path.join(portalRoot, "codebase-maps");
  if (fs.existsSync(mapsInPortal)) {
    return mapsInPortal;
  }
  return path.resolve(portalRoot, "../../codebase-maps");
}

export async function GET(request: Request, options?: { mapsRoot?: string }) {
  const mapsRoot = options?.mapsRoot ?? getMapsRoot();
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get("log") || "latest";
  const fileKey = searchParams.get("file") || "route-feature-architecture.md";

  const manifestPath = path.join(mapsRoot, "manifest.json");

  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      manifest = [];
    }
  }

  const targetDir = logId === "latest" ? path.join(mapsRoot, "latest") : path.join(mapsRoot, logId);
  const fallbackDir = fs.existsSync(targetDir) ? targetDir : mapsRoot;
  const filePath = path.join(fallbackDir, fileKey);

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
