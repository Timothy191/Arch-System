"use client";

import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  fetchWeather,
  getWeatherAlert,
  getWindDirection,
  type WeatherData,
} from "@/lib/weather-api";
import { GlassCard } from "@repo/ui/GlassCard";
import { cn } from "@repo/ui/lib/utils";

interface WeatherWidgetProps {
  lat?: number;
  lon?: number;
  locationName?: string;
  variant?: "compact" | "full" | "header";
}

export function WeatherWidget({
  lat = -26.35914,
  lon = 28.79267,
  locationName = "Delmas, Mpumalanga",
  variant = "full",
}: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWeather() {
      try {
        setLoading(true);
        const data = await fetchWeather(lat, lon, locationName);
        setWeather(data);
        setError(null);
      } catch (err) {
        setError("Failed to load weather");
      } finally {
        setLoading(false);
      }
    }

    loadWeather();
    // Refresh every 10 minutes
    const interval = setInterval(loadWeather, 600000);
    return () => clearInterval(interval);
  }, [lat, lon, locationName]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-arch-surface-tertiary rounded-xl" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <GlassCard className="p-3">
        <p className="text-arch-text-tertiary text-sm">Weather unavailable</p>
      </GlassCard>
    );
  }

  const alert = getWeatherAlert(weather);

  // Header variant - minimal with interactive Popover
  if (variant === "header") {
    return (
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            aria-label="Weather details"
            title="Weather details"
            className="relative flex items-center justify-center w-7 h-7 bg-black/[0.03] hover:bg-black/[0.06] border border-black/[0.05] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50 cursor-default outline-none active:scale-[0.97]"
          >
            <span className="text-lg leading-none">{weather.icon}</span>
            {alert.level !== "none" && (
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                  alert.level === "critical"
                    ? "bg-accent-red animate-pulse"
                    : alert.level === "warning"
                      ? "bg-accent-blue"
                      : "bg-accent-blue"
                }`}
              />
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="w-64 bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-window rounded-xl p-4 z-[120] focus:outline-none select-none"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.05]">
                <span
                  className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase truncate max-w-[130px]"
                  title={weather.location.name || locationName}
                >
                  {weather.location.name || locationName}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] shrink-0">
                  Updated{" "}
                  {new Date(weather.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Temp / Current Icon */}
              <div className="flex items-center gap-3">
                <span className="text-4xl">{weather.icon}</span>
                <div>
                  <p className="text-2xl font-semibold text-[var(--text-heading)]">
                    {weather.temperature}°C
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {weather.description} (Feels: {weather.feelsLike}°C)
                  </p>
                </div>
              </div>

              {/* Details (Wind/Humidity) */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-[var(--text-secondary)]">
                <div className="bg-black/[0.02] p-2 rounded-lg border border-black/[0.04] min-w-0">
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                    Wind
                  </p>
                  <p className="font-semibold text-[var(--text-heading)] truncate">
                    💨 {weather.windSpeed} km/h{" "}
                    {getWindDirection(weather.windDirection)}
                  </p>
                </div>
                <div className="bg-black/[0.02] p-2 rounded-lg border border-black/[0.04] min-w-0">
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                    Humidity
                  </p>
                  <p className="font-semibold text-[var(--text-heading)] truncate">
                    💧 {weather.humidity}%
                  </p>
                </div>
              </div>

              {/* Operations alert */}
              {alert.level !== "none" && (
                <div
                  className={cn(
                    "p-2.5 rounded-lg text-xs font-medium border",
                    alert.level === "critical"
                      ? "bg-accent-red/10 text-accent-red border-accent-red/20 animate-pulse"
                      : "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
                  )}
                >
                  {alert.message}
                </div>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{weather.icon}</span>
            <div>
              <p className="text-2xl font-semibold text-arch-text-primary">
                {weather.temperature}°C
              </p>
              <p className="text-sm text-arch-text-tertiary">
                {weather.description}
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-arch-text-tertiary">
            <p>💧 {weather.humidity}%</p>
            <p>💨 {weather.windSpeed} km/h</p>
          </div>
        </div>
        {alert.level !== "none" && (
          <div
            className={`mt-3 p-2 rounded-lg text-xs ${
              alert.level === "critical"
                ? "bg-accent-red/10 text-accent-red border border-accent-red/20"
                : alert.level === "warning"
                  ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                  : "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
            }`}
          >
            {alert.message}
          </div>
        )}
      </GlassCard>
    );
  }

  // Full variant with forecast
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-arch-text-primary">
            Weather Conditions
          </h3>
          <p className="text-sm text-arch-text-tertiary">
            {weather.location.name}
          </p>
        </div>
        <span className="text-xs text-arch-text-tertiary">
          Updated{" "}
          {new Date(weather.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Africa/Johannesburg",
          })}
        </span>
      </div>

      {/* Current conditions */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-5xl">{weather.icon}</span>
        <div>
          <p className="text-3xl font-semibold text-arch-text-primary">
            {weather.temperature}°C
          </p>
          <p className="text-arch-text-tertiary">
            Feels like {weather.feelsLike}°C
          </p>
          <p className="text-sm text-arch-text-secondary">
            {weather.description}
          </p>
        </div>
        <div className="ml-auto text-right text-sm space-y-1">
          <p className="text-arch-text-tertiary">
            💧 Humidity: {weather.humidity}%
          </p>
          <p className="text-arch-text-tertiary">
            💨 Wind: {weather.windSpeed} km/h
          </p>
          <p className="text-arch-text-tertiary">
            🧭 Direction: {weather.windDirection}°
          </p>
        </div>
      </div>

      {/* Operations alert */}
      {alert.level !== "none" && (
        <div
          className={`mb-6 p-3 rounded-lg ${
            alert.level === "critical"
              ? "bg-accent-red/10 border border-accent-red/30"
              : alert.level === "warning"
                ? "bg-accent-blue/10 border border-accent-blue/30"
                : "bg-accent-blue/10 border border-accent-blue/30"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              alert.level === "critical"
                ? "text-accent-red"
                : alert.level === "warning"
                  ? "text-accent-blue"
                  : "text-accent-blue"
            }`}
          >
            {alert.message}
          </p>
        </div>
      )}

      {/* 5-day forecast */}
      <div>
        <p className="text-sm font-medium text-arch-text-secondary mb-3">
          5-Day Forecast
        </p>
        <div className="grid grid-cols-5 gap-2">
          {weather.daily?.map((day, i) => (
            <div
              key={i}
              className="text-center p-2 rounded-lg bg-arch-surface-primary/50"
            >
              <p className="text-xs text-arch-text-tertiary mb-1">
                {new Date(day.date).toLocaleDateString([], {
                  weekday: "short",
                })}
              </p>
              <p className="text-lg mb-1">{day.icon}</p>
              <p className="text-xs text-arch-text-primary">{day.maxTemp}°</p>
              <p className="text-xs text-arch-text-tertiary">{day.minTemp}°</p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
