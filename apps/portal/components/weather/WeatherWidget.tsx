'use client';

import * as Popover from '@radix-ui/react-popover';
import { Card } from '@repo/ui/components/ui/card';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { cn } from '@repo/ui/lib/utils';
import { fetchClient } from '@repo/utils/client';
import React, { useEffect, useState } from 'react';
import { getWeatherAlert, getWindDirection, type WeatherData } from '@/lib/weather-api';

interface WeatherWidgetProps {
  lat?: number;
  lon?: number;
  locationName?: string;
  variant?: 'compact' | 'full' | 'header';
}

export const WeatherWidget = function WeatherWidget({
  lat: _lat = -26.35914,
  lon: _lon = 28.79267,
  locationName = 'Delmas, Mpumalanga',
  variant = 'full',
}: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWeather() {
      try {
        setLoading(true);
        // Fetch from API route using fetchClient to handle retry & error boundaries
        const data = await fetchClient.get<WeatherData>('/api/weather');
        setWeather(data);
        setError(null);
      } catch (_err) {
        setError('Failed to load weather');
      } finally {
        setLoading(false);
      }
    }

    loadWeather();
    // Refresh every 10 minutes
    const interval = setInterval(loadWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <Skeleton className="h-20 w-full rounded-xl" aria-label="Loading weather" />;
  }

  if (error || !weather) {
    return (
      <Card className="p-3">
        <p className="text-arch-text-tertiary text-sm">Weather unavailable</p>
      </Card>
    );
  }

  const alert = getWeatherAlert(weather);

  // Header variant - minimal with interactive Popover
  if (variant === 'header') {
    return (
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            aria-label="Weather details"
            title="Weather details"
            className="relative flex h-7 w-7 cursor-default items-center justify-center rounded-full border border-black/[0.05] bg-black/[0.03] outline-none transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50 active:scale-[0.97]"
          >
            <span className="text-lg leading-none">{weather.icon}</span>
            {alert.level !== 'none' && (
              <span
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${
                  alert.level === 'critical'
                    ? 'animate-pulse bg-accent-red'
                    : alert.level === 'warning'
                      ? 'bg-accent-blue'
                      : 'bg-accent-blue'
                }`}
              />
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-popover w-64 select-none rounded-xl border border-black/[0.08] bg-white/95 p-4 shadow-window backdrop-blur-2xl focus:outline-none"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between border-black/[0.05] border-b pb-1.5">
                <span
                  className="max-w-[130px] truncate font-bold text-[10px] text-[var(--text-muted)] uppercase tracking-wider"
                  title={weather.location.name || locationName}
                >
                  {weather.location.name || locationName}
                </span>
                <span className="shrink-0 text-[9px] text-[var(--text-muted)]">
                  Updated{' '}
                  {new Date(weather.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Temp / Current Icon */}
              <div className="flex items-center gap-3">
                <span className="text-4xl">{weather.icon}</span>
                <div>
                  <p className="font-semibold text-2xl text-[var(--text-heading)]">
                    {weather.temperature}°C
                  </p>
                  <p className="text-[var(--text-secondary)] text-xs">
                    {weather.description} (Feels: {weather.feelsLike}°C)
                  </p>
                </div>
              </div>

              {/* Details (Wind/Humidity) */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-[var(--text-secondary)] text-xs">
                <div className="min-w-0 rounded-lg border border-black/[0.04] bg-black/[0.02] p-2">
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                    Wind
                  </p>
                  <p className="truncate font-semibold text-[var(--text-heading)]">
                    💨 {weather.windSpeed} km/h {getWindDirection(weather.windDirection)}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-black/[0.04] bg-black/[0.02] p-2">
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                    Humidity
                  </p>
                  <p className="truncate font-semibold text-[var(--text-heading)]">
                    💧 {weather.humidity}%
                  </p>
                </div>
              </div>

              {/* Operations alert */}
              {alert.level !== 'none' && (
                <div
                  className={cn(
                    'rounded-lg border p-2.5 font-medium text-xs',
                    alert.level === 'critical'
                      ? 'animate-pulse border-accent-red/20 bg-accent-red/10 text-accent-red'
                      : 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue'
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
  if (variant === 'compact') {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{weather.icon}</span>
            <div>
              <p className="font-semibold text-2xl text-arch-text-primary">
                {weather.temperature}°C
              </p>
              <p className="text-arch-text-tertiary text-sm">{weather.description}</p>
            </div>
          </div>
          <div className="text-right text-arch-text-tertiary text-sm">
            <p>💧 {weather.humidity}%</p>
            <p>💨 {weather.windSpeed} km/h</p>
          </div>
        </div>
        {alert.level !== 'none' && (
          <div
            className={`mt-3 rounded-lg p-2 text-xs ${
              alert.level === 'critical'
                ? 'border border-accent-red/20 bg-accent-red/10 text-accent-red'
                : alert.level === 'warning'
                  ? 'border border-accent-blue/20 bg-accent-blue/10 text-accent-blue'
                  : 'border border-accent-blue/20 bg-accent-blue/10 text-accent-blue'
            }`}
          >
            {alert.message}
          </div>
        )}
      </Card>
    );
  }

  // Full variant with forecast
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-arch-text-primary text-lg">Weather Conditions</h3>
          <p className="text-arch-text-tertiary text-sm">{weather.location.name}</p>
        </div>
        <span className="text-arch-text-tertiary text-xs">
          Updated{' '}
          {new Date(weather.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Johannesburg',
          })}
        </span>
      </div>

      {/* Current conditions */}
      <div className="mb-6 flex items-center gap-4">
        <span className="text-5xl">{weather.icon}</span>
        <div>
          <p className="font-semibold text-3xl text-arch-text-primary">{weather.temperature}°C</p>
          <p className="text-arch-text-tertiary">Feels like {weather.feelsLike}°C</p>
          <p className="text-arch-text-secondary text-sm">{weather.description}</p>
        </div>
        <div className="ml-auto space-y-1 text-right text-sm">
          <p className="text-arch-text-tertiary">💧 Humidity: {weather.humidity}%</p>
          <p className="text-arch-text-tertiary">💨 Wind: {weather.windSpeed} km/h</p>
          <p className="text-arch-text-tertiary">🧭 Direction: {weather.windDirection}°</p>
        </div>
      </div>

      {/* Operations alert */}
      {alert.level !== 'none' && (
        <div
          className={`mb-6 rounded-lg p-3 ${
            alert.level === 'critical'
              ? 'border border-accent-red/30 bg-accent-red/10'
              : alert.level === 'warning'
                ? 'border border-accent-blue/30 bg-accent-blue/10'
                : 'border border-accent-blue/30 bg-accent-blue/10'
          }`}
        >
          <p
            className={`font-medium text-sm ${
              alert.level === 'critical'
                ? 'text-accent-red'
                : alert.level === 'warning'
                  ? 'text-accent-blue'
                  : 'text-accent-blue'
            }`}
          >
            {alert.message}
          </p>
        </div>
      )}

      {/* 5-day forecast */}
      <div>
        <p className="mb-3 font-medium text-arch-text-secondary text-sm">5-Day Forecast</p>
        <div className="grid grid-cols-5 gap-2">
          {weather.daily?.map((day, i) => (
            <div key={i} className="rounded-lg bg-arch-surface-primary/50 p-2 text-center">
              <p className="mb-1 text-arch-text-tertiary text-xs">
                {new Date(day.date).toLocaleDateString([], {
                  weekday: 'short',
                })}
              </p>
              <p className="mb-1 text-lg">{day.icon}</p>
              <p className="text-arch-text-primary text-xs">{day.maxTemp}°</p>
              <p className="text-arch-text-tertiary text-xs">{day.minTemp}°</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
