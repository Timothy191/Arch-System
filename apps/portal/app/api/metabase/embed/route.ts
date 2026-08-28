import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserSafely } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";

/**
 * Encodes a JSON payload object into a base64url string.
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Creates a signed JWT token using HMAC-SHA256 for Metabase embedding.
 */
function createMetabaseToken(
  dashboardId: number,
  params: Record<string, unknown>,
  secret: string,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    resource: { dashboard: dashboardId },
    params,
    iat: now,
    exp: now + 60 * 10, // 10 minutes expiration
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac("sha256", secret)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${dataToSign}.${signature}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, async () => {
    // 1. Authenticate user session
    const { user, error } = await getUserSafely();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // 2. Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const dashboardIdStr = searchParams.get("dashboardId");
    const departmentId = searchParams.get("departmentId");

    if (!dashboardIdStr) {
      return NextResponse.json({ error: "Missing dashboardId parameter" }, { status: 400 });
    }

    const dashboardId = parseInt(dashboardIdStr, 10);
    if (isNaN(dashboardId)) {
      return NextResponse.json({ error: "Invalid dashboardId parameter" }, { status: 400 });
    }

    const metabaseSecret =
      process.env.METABASE_SECRET_KEY || "dev_metabase_secret_key_change_in_prod";
    const metabaseSiteUrl =
      process.env.NEXT_PUBLIC_METABASE_SITE_URL || "http://localhost:3000/metabase";

    const params: Record<string, unknown> = {};
    if (departmentId) {
      params.department_id = departmentId;
    }

    // 3. Generate signed token and iframe URL
    const token = createMetabaseToken(dashboardId, params, metabaseSecret);
    const iframeUrl = `${metabaseSiteUrl}/embed/dashboard/${token}#bordered=true&titled=true`;

    return NextResponse.json({
      success: true,
      iframeUrl,
      expiresInSeconds: 600,
    });
  });
}
