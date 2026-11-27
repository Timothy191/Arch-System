'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { startTransition, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchWeather } from '@/lib/weather-api';

/**
 * WMO Weather interpretation codes for rain, drizzle, mist, showers, and thunderstorms.
 * 45, 48: Fog / depositing rime fog (thick mist)
 * 51, 53, 55: Drizzle
 * 61, 63, 65: Rain (slight, moderate, heavy)
 * 80, 81, 82: Rain showers
 * 95, 96, 99: Thunderstorms
 */
export const RAIN_MIST_WMO_CODES = new Set([
  45, 48, 51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99,
]);

const CHECK_INTERVAL_MS = 60_000;
const ONE_HOUR_MINUTES = 60;
const TWO_HOURS_MINUTES = 120;

export interface UseWeatherNaturalDelayMonitorOptions {
  departmentId: string;
  shiftDate: string;
  shiftType: 'day' | 'night';
  onAutoLogNaturalDelay?: (hours: number, reason: string) => void;
  enabled?: boolean;
}

export interface WeatherNaturalDelayMonitorState {
  isWeatherLinked: boolean;
  isRaining: boolean;
  weatherCode: number | null;
  weatherDescription: string | null;
  stalledMinutes: number;
  weatherAlertMessage: string | null;
  lastCheckedAt: Date | null;
}

export function useWeatherNaturalDelayMonitor({
  departmentId,
  shiftDate,
  shiftType,
  onAutoLogNaturalDelay,
  enabled = true,
}: UseWeatherNaturalDelayMonitorOptions): WeatherNaturalDelayMonitorState {
  const [state, setState] = useState<WeatherNaturalDelayMonitorState>({
    isWeatherLinked: true,
    isRaining: false,
    weatherCode: null,
    weatherDescription: null,
    stalledMinutes: 0,
    weatherAlertMessage: null,
    lastCheckedAt: null,
  });

  const lastLoggedHoursRef = useRef<number>(0);
  const onAutoLogRef = useRef(onAutoLogNaturalDelay);
  onAutoLogRef.current = onAutoLogNaturalDelay;

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    async function checkWeatherAndLoads() {
      try {
        const weather = await fetchWeather(-26.2, 28.0, 'Mining Site').catch(() => null);
        const weatherCode = weather?.weatherCode ?? null;
        const isRaining = weatherCode !== null && RAIN_MIST_WMO_CODES.has(weatherCode);

        let stalledMinutes = 0;
        const supabase = createBrowserSupabaseClient();
        const { data: loads } = await supabase
          .from('hourly_loads')
          .select('id, created_at, load_count')
          .eq('department_id', departmentId)
          .eq('shift_date', shiftDate)
          .eq('shift_type', shiftType)
          .order('created_at', { ascending: false })
          .limit(1);

        const now = new Date();
        if (loads && loads.length > 0 && loads[0]?.created_at) {
          const lastLoadTime = new Date(loads[0].created_at);
          stalledMinutes = Math.max(
            0,
            Math.floor((now.getTime() - lastLoadTime.getTime()) / 60_000)
          );
        } else {
          // If no load records for this shift yet, estimate elapsed shift minutes
          const shiftStartHour = shiftType === 'day' ? 6 : 18;
          const shiftStartTime = new Date(
            `${shiftDate}T${String(shiftStartHour).padStart(2, '0')}:00:00+02:00`
          );
          stalledMinutes = Math.max(
            0,
            Math.floor((now.getTime() - shiftStartTime.getTime()) / 60_000)
          );
        }

        let alertMessage: string | null = null;
        let targetAutoHours = 0;

        if (isRaining && stalledMinutes >= ONE_HOUR_MINUTES) {
          targetAutoHours = stalledMinutes >= TWO_HOURS_MINUTES ? 2.0 : 1.0;
          alertMessage = `Rain/mist detected (WMO ${weatherCode}) and hourly loads stalled for ${stalledMinutes}m — Auto-logged ${targetAutoHours.toFixed(1)}h Natural Delay`;

          if (targetAutoHours > lastLoggedHoursRef.current) {
            lastLoggedHoursRef.current = targetAutoHours;
            onAutoLogRef.current?.(targetAutoHours, alertMessage);
            toast.warning(alertMessage);
          }
        } else if (!isRaining && lastLoggedHoursRef.current > 0) {
          // Hourly loads or weather resumed
          lastLoggedHoursRef.current = 0;
        }

        if (isMounted) {
          startTransition(() => {
            setState({
              isWeatherLinked: true,
              isRaining,
              weatherCode,
              weatherDescription: weather?.description ?? null,
              stalledMinutes,
              weatherAlertMessage: alertMessage,
              lastCheckedAt: new Date(),
            });
          });
        }
      } catch {
        // Fallback silently if offline or network unavailable
      }
    }

    void checkWeatherAndLoads();
    const interval = setInterval(() => {
      void checkWeatherAndLoads();
    }, CHECK_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [departmentId, shiftDate, shiftType, enabled]);

  return state;
}
