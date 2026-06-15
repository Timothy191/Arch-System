import { NextRequest, NextResponse } from "next/server";
import { inngest, syncPlaybackEvent } from "@repo/utils/inngest";
import { logError } from "@/lib/errors/error-logger";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/response";
import { applyCors } from "@/lib/api/cors";
import { withBodyLimit } from "@/lib/api/body-limit";
import { syncPlaybackSchema } from "@repo/contract";

async function handlePlaybackRequest(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reqClone = req.clone();
    const body = await reqClone.json().catch(() => ({}));
    const { idempotencyKey, actionType, payload, departmentId } = body;
    if (!idempotencyKey || !actionType || !payload || !departmentId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const parsed = await validateBody(req, syncPlaybackSchema);
    if (parsed instanceof NextResponse) return parsed;

    await inngest.send({
      name: syncPlaybackEvent,
      data: {
        idempotencyKey: parsed.data.idempotencyKey,
        actionType: parsed.data.actionType,
        payload: parsed.data.payload,
        departmentId: parsed.data.departmentId,
      },
    });

    return NextResponse.json({ success: true, queued: true });
  } catch (err: unknown) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: "sync_playback",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withBodyLimit(
    req,
    async () => {
      return applyCors(
        req,
        await withRateLimit(req, () => handlePlaybackRequest(req)),
      );
    },
    { maxSize: 1048576 },
  );
}
