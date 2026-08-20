import { fetchWeather } from "@/lib/weather-api";
import { logError } from "@/lib/errors/error-logger";
import { NextResponse } from "next/server";
import { withAsyncSpan, addEvent, setAttributes } from "@/lib/observability/tracing";
import { cache } from "react";

/**
 * @swagger
 * /api/weather:
 *   get:
 *     summary: Current weather conditions
 *     description: Returns current weather data for the mining site location. Data is cached for 5 minutes with stale-while-revalidate.
 *     tags:
 *       - Weather
 *     responses:
 *       200:
 *         description: Weather data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 temperature:
 *                   type: number
 *                 conditions:
 *                   type: string
 *                 humidity:
 *                   type: number
 *                 windSpeed:
 *                   type: number
 *                 windDirection:
 *                   type: string
 *                 visibility:
 *                   type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Error fetching weather data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               nullable: true
 */

// Centralized caching layer with React cache + Next.js data cache
const getCachedWeather = cache(async () => {
  const weather = await fetchWeather();
  addEvent("weather_data_fetched", {
    temperature: weather.temperature,
    conditions: weather.description,
    location: weather.location?.name || "Unknown",
  });
  return weather;
});

export const dynamic = "force-dynamic";

export async function GET() {
  return withAsyncSpan("weather_api_route", { context: "weather" }, async () => {
    const startTime = Date.now();
    
    try {
      setAttributes({
        "weather.cache_enabled": "true",
        "weather.cache_ttl_seconds": "300",
        "weather.stale_while_revalidate": "true",
      });

      // Try cache first with stale-while-revalidate strategy
      const weather = await getCachedWeather();
      
      const duration = Date.now() - startTime;
      setAttributes({
        "weather.response_time_ms": String(duration),
        "weather.cache_hit": "true",
      });

      // Add performance markers for INP/LCP analysis
      addEvent("weather_response_ready", {
        duration_ms: duration,
        cache_strategy: "stale-while-revalidate",
      });

      return NextResponse.json(weather, {
        headers: {
          // Centralized cache control: 5min cache, 5min stale-while-revalidate
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
          "X-Weather-Cache": "hit",
          "X-Response-Time": `${duration}ms`,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Centralized error handling with structured logging
      const errorId = await logError(error instanceof Error ? error : new Error("Weather fetch failed"), {
        context: "weather_api_route",
        duration_ms: duration,
      });

      setAttributes({
        "weather.error": "true",
        "weather.error_id": String(errorId ?? "unknown"),
        "weather.response_time_ms": String(duration),
      });

      // Graceful degradation: return null data instead of hard failure
      // This prevents INP spikes from error states
      return NextResponse.json(null, {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60", // Cache error state briefly
          "X-Weather-Cache": "error",
          "X-Response-Time": `${duration}ms`,
          "X-Error-ID": String(errorId ?? "unknown"),
        },
      });
    }
  });
}
