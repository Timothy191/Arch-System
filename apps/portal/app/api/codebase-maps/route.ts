import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

function getMapsRoot() {
  let current = process.cwd();
  while (current !== "/" && current !== path.dirname(current)) {
    const candidate = path.join(current, "codebase-maps");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "../../codebase-maps");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get("log") || "latest";
  const fileKey = searchParams.get("file") || "route-feature-architecture.md";

  const mapsRoot = getMapsRoot();
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
