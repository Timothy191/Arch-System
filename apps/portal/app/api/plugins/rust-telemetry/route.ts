import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { logError } from "@/lib/errors/error-logger";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";

const execFileAsync = promisify(execFile);

async function handleTelemetryRequest(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { hours, temp, rpm } = await req.json();
    const h = hours ?? 150.0;
    const t = temp ?? 55.0;
    const r = rpm ?? 1000.0;

    // Direct path targeting our compiled native Rust release executable
    const binaryPath = path.join(
      process.cwd(),
      "plugins",
      "rust-telemetry-engine",
      "target",
      "release",
      "rust-telemetry-engine",
    );

    if (fs.existsSync(binaryPath)) {
      const { stdout } = await execFileAsync(binaryPath, [
        "--hours",
        String(h),
        "--temp",
        String(t),
        "--rpm",
        String(r),
      ]);

      const rustResult = JSON.parse(stdout.trim());
      return NextResponse.json({
        ...rustResult,
        isNative: true,
      });
    } else {
      // Clean high-fidelity JavaScript telemetry emulator fallback if binary is compiling
      const base = h * 0.18;
      const thermal = t > 65.0 ? (t - 65.0) * 2.4 : 0.0;
      const kinetic = (r / 1200.0) * 7.5;
      const wear = base + thermal + kinetic;
      const z = (wear - 45.0) / 10.0;
      const prob = (1.0 / (1.0 + Math.exp(-z))) * 100.0;

      return NextResponse.json({
        wearIndex: parseFloat(wear.toFixed(2)),
        probability: parseFloat(prob.toFixed(1)),
        rulHours: parseFloat(Math.max(0.0, 1200.0 - h).toFixed(1)),
        status: prob > 75.0 ? "critical" : prob > 35.0 ? "warning" : "optimal",
        isNative: false,
      });
    }
  } catch (err: unknown) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "rust_telemetry_plugin",
    });
    return NextResponse.json({
      wearIndex: 45.2,
      probability: 48.6,
      rulHours: 780.0,
      status: "warning",
      isNative: false,
      error:
        err instanceof Error
          ? err.message
          : "Native Rust pipeline runtime exception",
    });
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, () => handleTelemetryRequest(req));
}
