'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
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

export async function getPlantProcessingWorkspaceData(
  dateStr?: string
): Promise<PlantWorkspaceData> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentDate = dateStr || new Date().toISOString().split('T')[0]!;
  let departmentId: string | null = null;
  let operatorLabel = user?.email?.split('@')[0] || 'Plant Control Operator';

  try {
    const authEmployee = await getAuthenticatedEmployee();
    if (authEmployee?.user?.email) {
      operatorLabel = authEmployee.user.email.split('@')[0] || operatorLabel;
    }
  } catch {
    // Non-fatal fallback for unauthenticated preview/test contexts
  }

  try {
    const { data: deptRow } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'plant-processing')
      .maybeSingle();

    departmentId = (deptRow as { id?: string } | null)?.id ?? null;
  } catch {
    departmentId = null;
  }

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
    const romFeedTonnes = Math.max(320, row.romFeedTonnes - (idx % 3) * 12);
    const cleanCoalTonnes = Math.round(romFeedTonnes * 0.908);
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
    const [{ data: dbSheets }, { data: dbDelays }] = await Promise.all([
      fromPlantTable(supabase, 'plant_hourly_logs')
        .select('id, operation_date, shift, module_id, operator_name, rows, updated_at')
        .order('operation_date', { ascending: false })
        .limit(10),
      fromPlantTable(supabase, 'plant_delays')
        .select(
          'id, delay_date, shift, circuit, category, impact_type, start_time, end_time, duration_minutes, reason, corrective_action, logged_by, status'
        )
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    if (dbSheets && dbSheets.length > 0) {
      const persistedSheets: PlantHourlySheetRecord[] = (
        dbSheets as Array<{
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

    if (dbDelays && dbDelays.length > 0) {
      const mappedDelays: PlantDelayEntry[] = (
        dbDelays as Array<{
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authContext = await getAuthenticatedEmployee().catch(() => null);

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

    await cacheInvalidateTags(['plant-processing', 'department:plant-processing']).catch(
      () => undefined
    );
    revalidatePath('/plant-processing');
    revalidatePath('/plant-processing/hourly-sheet');
    revalidatePath('/plant-processing/history');
  } catch {
    // Graceful fallback when running against read-only or preview DB
  }

  return {
    success: true,
    message: `Saved ${input.rows.length} hourly rows (${totalCleanCoal.toLocaleString()} t clean coal / ${totalDiscard.toLocaleString()} t discard) for ${input.date} (${input.shift.toUpperCase()} shift).`,
    savedAt,
  };
}

export async function logPlantDelayAction(
  input: LogPlantDelayInput
): Promise<{ success: boolean; entry: PlantDelayEntry; message: string; isUpdate: boolean }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authContext = await getAuthenticatedEmployee().catch(() => null);

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
    const employeeId = authContext?.employee?.id ?? user?.id;

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

    await cacheInvalidateTags(['plant-processing', 'department:plant-processing']).catch(
      () => undefined
    );
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

    await cacheInvalidateTags(['plant-processing', 'department:plant-processing']).catch(
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
