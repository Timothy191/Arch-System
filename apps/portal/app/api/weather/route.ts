import { fetchWeather } from "@/lib/weather-api";
import { logError } from "@/lib/errors/error-logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const weather = await fetchWeather();
    return NextResponse.json(weather, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    await logError(
      error instanceof Error ? error : new Error("Weather fetch failed"),
      {
        context: "weather_api",
      },
    );
    return NextResponse.json(null);
  }
}
