import {
  evaluateFleetMaintenanceRisk,
  evaluateTelemetryAnomalies,
  type MachineHealthInput,
  type TelemetryReadingInput,
} from '@repo/intelligence';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';

const THIRTY_DAYS_MS = 30 * 86_400_000;
const TELEMETRY_HISTORY_LIMIT = 200;

interface BreakdownRow {
  readonly machine_id: string | null;
  readonly date_in: string;
}

interface MachineRow {
  readonly id: string;
  readonly name: string;
  readonly machine_type?: string | null;
  readonly type?: string | null;
  readonly active?: boolean | null;
  readonly current_smu?: number | null;
}

interface TelemetryRow {
  readonly machine_id: string;
  readonly recorded_at: string;
  readonly engine_temp?: number | null;
  readonly hydraulic_pressure?: number | null;
  readonly vibration_level?: number | null;
  readonly engine_rpm?: number | null;
  readonly fuel_level?: number | null;
}

async function fetchRecentTelemetry(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  machineIds: readonly string[]
): Promise<Map<string, TelemetryReadingInput[]>> {
  const byMachine = new Map<string, TelemetryReadingInput[]>();
  try {
    const query = supabase.from('machine_telemetry');
    if (!query || typeof query.select !== 'function') return byMachine;

    const { data: rows } = await query
      .select(
        'machine_id, recorded_at, engine_temp, hydraulic_pressure, vibration_level, engine_rpm, fuel_level'
      )
      .in('machine_id', [...machineIds])
      .order('recorded_at', { ascending: true })
      .limit(TELEMETRY_HISTORY_LIMIT);

    for (const row of (rows as TelemetryRow[] | null) ?? []) {
      const existing = byMachine.get(row.machine_id) ?? [];
      existing.push({
        machineId: row.machine_id,
        recordedAt: row.recorded_at,
        engineTempC: row.engine_temp,
        hydraulicPressureBar: row.hydraulic_pressure,
        vibrationLevelMmS: row.vibration_level,
        engineRpm: row.engine_rpm,
        fuelLevelPct: row.fuel_level,
      });
      byMachine.set(row.machine_id, existing);
    }
  } catch {
    // Telemetry enrichment is best-effort; breakdown + SMU scoring still runs.
  }
  return byMachine;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'API_ERROR' } },
        { status: 401 }
      );
    }

    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

    const { data: breakdowns, error } = await supabase
      .from('breakdowns')
      .select('machine_id, date_in')
      .gte('date_in', thirtyDaysAgo)
      .is('deleted_at', null);

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: 'API_ERROR' } },
        { status: 500 }
      );
    }

    const machineBreakdownCount: Record<string, number> = {};
    for (const entry of (breakdowns as BreakdownRow[] | null) ?? []) {
      if (entry.machine_id) {
        machineBreakdownCount[entry.machine_id] =
          (machineBreakdownCount[entry.machine_id] || 0) + 1;
      }
    }

    const candidateMachineIds = Object.keys(machineBreakdownCount);
    if (candidateMachineIds.length === 0) {
      return NextResponse.json({ predictions: [] });
    }

    const { data: machines } = await supabase
      .from('machines')
      .select('id, name, machine_type, active')
      .in('id', candidateMachineIds);

    const machineRows = (machines as MachineRow[] | null) ?? [];
    if (machineRows.length === 0) {
      return NextResponse.json({ predictions: [] });
    }

    const telemetryByMachine = await fetchRecentTelemetry(supabase, candidateMachineIds);

    const healthInputs: MachineHealthInput[] = machineRows.map((machine) => {
      const readings = telemetryByMachine.get(machine.id) ?? [];
      const anomalies = evaluateTelemetryAnomalies({
        machineId: machine.id,
        readings,
      });
      return {
        machineId: machine.id,
        machineName: machine.name,
        machineType: machine.machine_type ?? machine.type ?? 'unknown',
        breakdownCount30d: machineBreakdownCount[machine.id] ?? 0,
        currentSmuHours: machine.current_smu ?? null,
        anomalies,
      };
    });

    const predictions = evaluateFleetMaintenanceRisk(healthInputs).map((prediction) => ({
      machine_id: prediction.machineId,
      machine_name: prediction.machineName,
      type: prediction.machineType,
      risk_level: prediction.riskLevel,
      risk_score: prediction.riskScore,
      fmea_rpn: prediction.fmeaRpn,
      failure_mode: prediction.failureMode,
      estimated_hours_to_failure: prediction.estimatedHoursToFailure,
      confidence: prediction.confidence,
      reason: prediction.reason,
      recommended_action: prediction.recommendedAction,
    }));

    return NextResponse.json({ predictions });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unexpected error',
          code: 'API_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
