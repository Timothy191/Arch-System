import { NextResponse } from "next/server";

export function applyCors(request: Request, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin") || "*";
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-scanner-token, x-scanner-source, x-device-id, apikey, x-client-info");
  return response;
}
