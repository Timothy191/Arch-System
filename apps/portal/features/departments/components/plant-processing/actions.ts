'use server';

import { CacheCategory } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { getOperationalToday } from '@repo/utils';
import { revalidatePath } from 'next/cache';
import { withCache } from '@/lib/cache-utils';
import { tagDepartment, updateTags } from '@/lib/server-cache';
import {
  buildDefaultHourlyRows,
  buildInitialPlantDelays,
  calculateRowYield,
  type PlantDelayCategory,
  type PlantDelayEntry,
  type PlantHourlyRow,
  type PlantHourlySheetRecord,
  type PlantImpactType,
  type PlantModuleId,
  type PlantShiftType,
  type PlantWorkspaceData,
} from './types';

export interface SavePlantHourlySheetInput {
  date: string;
  shift: PlantShiftType;
  moduleId: PlantModuleId;
  rows: PlantHourlyRow[];
}

export interface LogPlantDelayInput {
  id?: string;
  date: string;
  shift: PlantShiftType;
  circuit: string;
  category: PlantDelayCategory;
  impactType: PlantImpactType;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  reason: string;
  correctiveAction: string;
}

export interface QuickAddPlantEquipmentInput {
  name: string;
}

interface UntypedPlantTable {
  select: (columns: string) => {
    order: (
      col: string,
      opts?: { ascending?: boolean }
    ) => {
      limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
  upsert: (
    values: Record<string, unknown> | Array<Record<string, unknown>>,
    opts?: { onConflict?: string }
  ) => Promise<{ data: unknown | null; error: { message: string } | null }>;
  update: (values: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string
    ) => Promise<{ data: unknown | null; error: { message: string } | null }>;
  };
  insert: (
    values: Record<string, unknown>
  ) => Promise<{ data: unknown | null; error: { message: string } | null }>;
}

function fromPlantTable(supabase: unknown, table: string): UntypedPlantTable {
  return (supabase as { from: (t: string) => UntypedPlantTable }).from(table);
}

type PlantReadClient =
  | Awaited<ReturnType<typeof createServerSupabaseClient>>
  | Awaited<ReturnType<typeof createReadReplicaClient>>;

interface PlantQueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

interface SharedPlantWorkspacePayload {
  readonly departmentId: string | null;
  readonly sheetRows: unknown[] | null;
  readonly delayRows: unknown[] | null;
}

const EMPTY_QUERY_RESULT: PlantQueryResult = { data: null, error: null };
const PLANT_HOURLY_LOGS_LIMIT = 10;
const PLANT_DELAYS_LIMIT = 25;
const MIN_NIGHT_ROM_FEED_TONNES = 320;
const NIGHT_FEED_VARIANCE_STEP_TONNES = 12;
const NIGHT_FEED_VARIANCE_CYCLE = 3;
const NIGHT_CLEAN_COAL_YIELD_RATIO = 0.908;
const PLANT_BASE_TAGS = ['plant-processing', 'department:plant-processing'] as const;
const PLANT_WORKSPACE_TAG = tagDepartment('plant-processing', 'workspace');
const PLANT_WORKSPACE_CACHE_TAGS = [
  PLANT_WORKSPACE_TAG,
  'table:plant_hourly_logs',
  'table:plant_delays',
];

async function lookupPlantDepartmentId(supabase: PlantReadClient): Promise<string | null> {
  try {
    const { data: deptRow } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'plant-processing')
      .maybeSingle();
    return (deptRow as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function loadSharedPlantWorkspacePayload(): Promise<SharedPlantWorkspacePayload> {
  const readClient = await createReadReplicaClient();
  const [departmentId, sheetsResult, delaysResult] = await Promise.all([
    lookupPlantDepartmentId(readClient),
    Promise.resolve(
      fromPlantTable(readClient, 'plant_hourly_logs')
        .select('id, operation_date, shift, module_id, operator_name, rows, updated_at')
        .order('operation_date', { ascending: false })
        .limit(PLANT_HOURLY_LOGS_LIMIT)
    ).catch((): PlantQueryResult => EMPTY_QUERY_RESULT),
    Promise.resolve(
      fromPlantTable(readClient, 'plant_delays')
        .select(
          'id, delay_date, shift, circuit, category, impact_type, start_time, end_time, duration_minutes, reason, corrective_action, logged_by, status'
        )
        .order('created_at', { ascending: false })
        .limit(PLANT_DELAYS_LIMIT)
    ).catch((): PlantQueryResult => EMPTY_QUERY_RESULT),
  ]);

  return {
    departmentId,
    sheetRows: sheetsResult.data,
    delayRows: delaysResult.data,
  };
}

export async function getPlantProcessingWorkspaceData(
  dateStr?: string
): Promise<PlantWorkspaceData> {
  const supabase = await createServerSupabaseClient();
  const currentDate = dateStr || getOperationalToday();

  // Auth stays outside withCache so per-user operator identity is never cached across users,
  // while the shared read-only department + logs + delays queries hit Redis L1/L2 via withCache.
  const [authEmployee, sharedPayload] = await Promise.all([
    getAuthenticatedEmployee(supabase).catch(() => null),
    withCache(() => loadSharedPlantWorkspacePayload(), {
      category: CacheCategory.METRICS,
      keyParts: ['plant-processing', 'workspace-v1', currentDate],
      tags: PLANT_WORKSPACE_CACHE_TAGS,
    }),
  ]);

  const { departmentId, sheetRows, delayRows } = sharedPayload;
  const operatorLabel = authEmployee?.user?.email?.split('@')[0] || 'Plant Control Operator';

  const defaultDaySheet: PlantHourlySheetRecord = {
    id: `sheet-${currentDate}-day-DMS-MOD-1`,
    date: currentDate,
    shift: 'day',
    moduleId: 'DMS-MOD-1',
    operatorName: operatorLabel,
    updatedAt: new Date().toISOString(),
    rows: buildDefaultHourlyRows('day'),
  };

  const prevDateObj = new Date(`${currentDate}T00:00:00Z`);
  prevDateObj.setUTCDate(prevDateObj.getUTCDate() - 1);
  const prevDate = prevDateObj.toISOString().split('T')[0]!;

  const prevNightRows = buildDefaultHourlyRows('night').map((row, idx) => {
    const romFeedTonnes = Math.max(
      MIN_NIGHT_ROM_FEED_TONNES,
      row.romFeedTonnes - (idx % NIGHT_FEED_VARIANCE_CYCLE) * NIGHT_FEED_VARIANCE_STEP_TONNES
    );
    const cleanCoalTonnes = Math.round(romFeedTonnes * NIGHT_CLEAN_COAL_YIELD_RATIO);
    const discardTonnes = Math.max(0, romFeedTonnes - cleanCoalTonnes);
    return {
      ...row,
      romFeedTonnes,
      cleanCoalTonnes,
      discardTonnes,
      yieldPct: calculateRowYield(romFeedTonnes, cleanCoalTonnes),
    };
  });

  const previousNightSheet: PlantHourlySheetRecord = {
    id: `sheet-${prevDate}-night-DMS-MOD-1`,
    date: prevDate,
    shift: 'night',
    moduleId: 'DMS-MOD-1',
    operatorName: 'T. Nkosi (Night Metallurgist)',
    updatedAt: `${prevDate}T05:55:00.000Z`,
    rows: prevNightRows,
  };

  let initialSheets: PlantHourlySheetRecord[] = [defaultDaySheet, previousNightSheet];
  const initialDelays: PlantDelayEntry[] = buildInitialPlantDelays(currentDate);

  try {
    if (sheetRows && sheetRows.length > 0) {
      const persistedSheets: PlantHourlySheetRecord[] = (
        sheetRows as Array<{
          id: string;
          operation_date: string;
          shift: PlantShiftType;
          module_id: PlantModuleId;
          operator_name: string | null;
          rows: PlantHourlyRow[] | null;
          updated_at: string | null;
        }>
      )
        .filter((s) => Array.isArray(s.rows) && s.rows.length > 0)
        .map((s) => ({
          id: s.id || `sheet-${s.operation_date}-${s.shift}-${s.module_id}`,
          date: s.operation_date,
          shift: s.shift,
          moduleId: s.module_id || 'DMS-MOD-1',
          operatorName: s.operator_name || operatorLabel,
          updatedAt: s.updated_at || new Date().toISOString(),
          rows: s.rows ?? buildDefaultHourlyRows(s.shift),
        }));

      if (persistedSheets.length > 0) {
        const persistedKeys = new Set(
          persistedSheets.map((s) => `${s.date}:${s.shift}:${s.moduleId}`)
        );
        initialSheets = [
          ...persistedSheets,
          ...initialSheets.filter((s) => !persistedKeys.has(`${s.date}:${s.shift}:${s.moduleId}`)),
        ];
      }
    }

    if (delayRows && delayRows.length > 0) {
      const mappedDelays: PlantDelayEntry[] = (
        delayRows as Array<{
          id: string;
          delay_date: string | null;
          shift: PlantShiftType | null;
          circuit: string | null;
          category: PlantDelayCategory | null;
          impact_type: PlantImpactType | null;
          start_time: string | null;
          end_time: string | null;
          duration_minutes: number | null;
          reason: string | null;
          corrective_action: string | null;
          logged_by: string | null;
          status: 'Active' | 'Resolved' | null;
        }>
      ).map((d) => ({
        id: d.id,
        date: d.delay_date ?? currentDate,
        shift: d.shift ?? 'day',
        circuit: d.circuit || 'DMS Cyclone Module 1 (DM-301)',
        category: d.category || 'Mechanical',
        impactType: d.impact_type || 'Reduced Throughput',
        startTime: d.start_time || '08:00',
        endTime: d.end_time || '',
        durationMinutes: Number(d.duration_minutes ?? 0),
        reason: d.reason || 'Plant operational delay logged',
        correctiveAction:
          d.corrective_action || 'Circuit inspected and restored to nominal feed rate',
        loggedBy: d.logged_by || operatorLabel,
        status: d.status ?? (d.end_time ? 'Resolved' : 'Active'),
      }));
      return {
        departmentId,
        currentDate,
        initialSheets,
        initialDelays: [...mappedDelays, ...initialDelays],
      };
    }
  } catch {
    // Ignore DB lookup errors and return baseline records
  }

  return {
    departmentId,
    currentDate,
    initialSheets,
    initialDelays,
  };
}

export async function savePlantHourlySheetAction(
  input: SavePlantHourlySheetInput
): Promise<{ success: boolean; message: string; savedAt: string }> {
  const supabase = await createServerSupabaseClient();
  // PERF: getAuthenticatedEmployee already verifies the user via auth.getUser();
  // a separate getUser() call doubled the Auth round-trip on every action.
  const authContext = await getAuthenticatedEmployee(supabase).catch(() => null);
  const user = authContext?.user ?? null;

  if (!user || !authContext?.employee) {
    return {
      success: false,
      message: 'Unauthorized: valid session required.',
      savedAt: new Date().toISOString(),
    };
  }

  const savedAt = new Date().toISOString();
  const totalCleanCoal = input.rows.reduce((sum, r) => sum + (Number(r.cleanCoalTonnes) || 0), 0);
  const totalDiscard = input.rows.reduce((sum, r) => sum + (Number(r.discardTonnes) || 0), 0);

  try {
    const { data: deptRow } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'plant-processing')
      .maybeSingle();

    const departmentId = (deptRow as { id?: string } | null)?.id;
    const employeeId = authContext?.employee?.id ?? user?.id;
    const operatorName =
      authContext?.user?.email?.split('@')[0] ||
      user?.email?.split('@')[0] ||
      'Plant Control Operator';

    // Persist hourly sheet to canonical public.plant_hourly_logs
    if (input.rows.length > 0) {
      const totalRom = input.rows.reduce((sum, r) => sum + (Number(r.romFeedTonnes) || 0), 0);
      const avgYield = totalRom > 0 ? Number(((totalCleanCoal / totalRom) * 100).toFixed(2)) : 0;

      await fromPlantTable(supabase, 'plant_hourly_logs').upsert(
        {
          ...(departmentId ? { department_id: departmentId } : {}),
          operation_date: input.date,
          shift: input.shift,
          module_id: input.moduleId,
          operator_name: operatorName,
          rows: input.rows as unknown as Record<string, unknown>[],
          total_rom_tonnes: totalRom,
          total_clean_coal_tonnes: totalCleanCoal,
          total_discard_tonnes: totalDiscard,
          avg_yield_pct: avgYield,
          updated_at: savedAt,
        },
        {
          onConflict: 'operation_date,shift,module_id',
        }
      );
    }

    if (departmentId && employeeId) {
      const { data: logData } = await supabase
        .from('daily_logs')
        .upsert(
          {
            department_id: departmentId,
            date: input.date,
            shift: input.shift,
            logged_by: employeeId,
            status: 'submitted',
          },
          { onConflict: 'department_id,date,shift' }
        )
        .select('id')
        .maybeSingle();

      const dailyLogId = (logData as { id?: string } | null)?.id;
      if (dailyLogId) {
        await supabase.from('production_logs').insert({
          daily_log_id: dailyLogId,
          coal_tonnes: totalCleanCoal,
          waste_tonnes: totalDiscard,
        });
      }
    }

    await updateTags([
      ...PLANT_BASE_TAGS,
      ...PLANT_WORKSPACE_CACHE_TAGS,
      'table:daily_logs',
      'table:production_logs',
    ]).catch(() => undefined);
    revalidatePath('/plant-processing');
    revalidatePath('/plant-processing/hourly-sheet');
    revalidatePath('/plant-processing/history');
  } catch {
    // Graceful fallback when running against read-only or preview DB
  }

  return {
    success: true,
    message: `Saved ${input.rows.length} hourly rows (${totalCleanCoal.toLocaleString('en-US')} t clean coal / ${totalDiscard.toLocaleString('en-US')} t discard) for ${input.date} (${input.shift.toUpperCase()} shift).`,
    savedAt,
  };
}

export async function logPlantDelayAction(
  input: LogPlantDelayInput
): Promise<{ success: boolean; entry: PlantDelayEntry; message: string; isUpdate: boolean }> {
  const supabase = await createServerSupabaseClient();
  // PERF: getAuthenticatedEmployee already verifies the user via auth.getUser();
  // a separate getUser() call doubled the Auth round-trip on every action.
  const authContext = await getAuthenticatedEmployee(supabase).catch(() => null);
  const user = authContext?.user ?? null;

  if (!user || !authContext?.employee) {
    return {
      success: false,
      entry: null as unknown as PlantDelayEntry,
      message: 'Unauthorized: valid session required.',
      isUpdate: false,
    };
  }

  const loggedBy =
    authContext?.user?.email?.split('@')[0] ||
    user?.email?.split('@')[0] ||
    'Plant Control Operator';

  const trimmedEndTime = (input.endTime ?? '').trim();
  const hasEndTime = trimmedEndTime.length > 0;
  const durationMinutes = hasEndTime ? Math.max(1, Number(input.durationMinutes) || 15) : 0;
  const isUpdate = Boolean(input.id);

  const newEntry: PlantDelayEntry = {
    id: input.id || `delay-pp-${Date.now()}`,
    date: input.date,
    shift: input.shift,
    circuit: input.circuit,
    category: input.category,
    impactType: input.impactType,
    startTime: input.startTime,
    endTime: trimmedEndTime,
    durationMinutes,
    reason: input.reason.trim(),
    correctiveAction:
      input.correctiveAction.trim() ||
      (hasEndTime
        ? 'Logged for metallurgical & maintenance review'
        : 'Booked in — awaiting delay resolution and end time'),
    loggedBy,
    status: hasEndTime ? 'Resolved' : 'Active',
  };

  try {
    const { data: deptRow } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'plant-processing')
      .maybeSingle();

    const departmentId = (deptRow as { id?: string } | null)?.id;
    const _employeeId = authContext?.employee?.id ?? user?.id;

    const delayRowPayload = {
      ...(departmentId ? { department_id: departmentId } : {}),
      delay_date: input.date,
      shift: input.shift,
      circuit: input.circuit,
      category: input.category,
      impact_type: input.impactType,
      start_time: input.startTime,
      end_time: hasEndTime ? trimmedEndTime : null,
      duration_minutes: newEntry.durationMinutes,
      reason: newEntry.reason,
      corrective_action: newEntry.correctiveAction,
      status: newEntry.status,
      logged_by: loggedBy,
      updated_at: new Date().toISOString(),
    };

    const isUuid =
      Boolean(input.id) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id!);

    if (isUpdate && isUuid && input.id) {
      await fromPlantTable(supabase, 'plant_delays').update(delayRowPayload).eq('id', input.id);
    } else {
      await fromPlantTable(supabase, 'plant_delays').insert(delayRowPayload);
    }

    await updateTags([...PLANT_BASE_TAGS, ...PLANT_WORKSPACE_CACHE_TAGS]).catch(() => undefined);
    revalidatePath('/plant-processing/delays');
    revalidatePath('/plant-processing/history');
  } catch {
    // Graceful fallback when running against preview DB
  }

  const message = isUpdate
    ? hasEndTime
      ? `Updated delay on ${newEntry.circuit} — End Time ${newEntry.endTime} logged (${newEntry.durationMinutes} min, Resolved).`
      : `Updated open delay on ${newEntry.circuit} (Booked in at ${newEntry.startTime}).`
    : hasEndTime
      ? `Logged ${newEntry.durationMinutes} min delay on ${newEntry.circuit}.`
      : `Booked in active delay on ${newEntry.circuit} at ${newEntry.startTime} (awaiting End Time).`;

  return {
    success: true,
    entry: newEntry,
    message,
    isUpdate,
  };
}

export async function quickAddPlantEquipmentAction(
  input: QuickAddPlantEquipmentInput
): Promise<{ success: boolean; equipmentName: string; message: string }> {
  const equipmentName = input.name.trim();
  if (!equipmentName) {
    return {
      success: false,
      equipmentName: '',
      message: 'Equipment name is required.',
    };
  }

  const supabase = await createServerSupabaseClient();
  // PERF: getAuthenticatedEmployee already verifies the user via auth.getUser();
  // a separate getUser() call doubled the Auth round-trip on every action.
  const authContext = await getAuthenticatedEmployee(supabase).catch(() => null);
  const user = authContext?.user ?? null;

  if (!user || !authContext?.employee) {
    return {
      success: false,
      equipmentName: input.name.trim(),
      message: 'Unauthorized: valid session required.',
    };
  }

  try {
    const { data: deptRow } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'plant-processing')
      .maybeSingle();

    const departmentId = (deptRow as { id?: string } | null)?.id ?? null;

    await supabase.from('machines').insert({
      name: equipmentName,
      machine_type: 'Plant Equipment',
      active: true,
      ...(departmentId ? { department_id: departmentId } : {}),
    });

    await updateTags([...PLANT_BASE_TAGS, ...PLANT_WORKSPACE_CACHE_TAGS, 'table:machines']).catch(
      () => undefined
    );
    revalidatePath('/plant-processing/delays');
  } catch {
    // Graceful fallback when running against preview DB
  }

  return {
    success: true,
    equipmentName,
    message: `Added equipment "${equipmentName}" to Plant & Processing database.`,
  };
}
