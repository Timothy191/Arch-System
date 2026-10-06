import {
  machineOperatorScanRequestSchema,
  machineOperatorScanResponseSchema,
  z,
} from '@repo/contract';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { getCurrentShift, getOperationalToday } from '@repo/utils';
import { NextResponse } from 'next/server';
import { logError } from '@/lib/errors/error-logger';

const serviceRow = <T extends z.ZodType>(schema: T) => z.array(schema);

const badgeRowsSchema = serviceRow(
  z.object({
    is_active: z.boolean().nullable(),
    entity_type: z.string(),
    personnel_id: z.string().uuid().nullable(),
    expires_at: z.string().nullable(),
  })
);

const personnelRowsSchema = serviceRow(
  z.object({
    emp_code: z.string(),
    first_name: z.string(),
    surname: z.string(),
    job_title: z.string().nullable(),
    status: z.string().nullable(),
    medical_expiry: z.string().nullable(),
    induction_expiry: z.string().nullable(),
  })
);

type ScanMachine = {
  id: string;
  name: string;
  machine_type: string;
  site_id: string | null;
  bin_factor: number | null;
  active: boolean;
};

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json({ error, code }, { status });
}

function dateIsCurrent(value: string | null, now: Date): boolean {
  if (!value) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value >= getOperationalToday('Africa/Johannesburg');
  }
  const expiry = new Date(value);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() >= now.getTime();
}

function operationalTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${getPart('hour')}:${getPart('minute')}:${getPart('second')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

async function readServiceRows<T extends z.ZodType>(
  table: 'badges' | 'personnel',
  select: string,
  column: 'qr_code' | 'rfid_code' | 'id' | 'emp_code',
  value: string,
  schema: T
): Promise<z.infer<T>[]> {
  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error('Supabase service credentials are not configured');
  }

  const params = new URLSearchParams({ select, [column]: `eq.${value}`, limit: '2' });
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Privileged ${table} lookup failed with HTTP ${response.status}`);
  }

  const parsed = serviceRow(schema).safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(`Privileged ${table} lookup returned an invalid response`);
  }
  return parsed.data;
}

async function findMachine(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  code: string | undefined,
  machineId?: string
) {
  const columns = 'id, name, machine_type, site_id, bin_factor, active';
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (machineId) {
    const { data, error } = await supabase
      .from('machines')
      .select(columns)
      .eq('id', machineId)
      .maybeSingle();
    if (error) throw new Error(`Machine lookup failed: ${error.message}`);
    return data as ScanMachine | null;
  }
  if (!code) return null;
  if (uuidPattern.test(code)) {
    const { data, error } = await supabase
      .from('machines')
      .select(columns)
      .eq('id', code)
      .maybeSingle();
    if (error) throw new Error(`Machine lookup failed: ${error.message}`);
    if (data) return data as ScanMachine;
  }

  const { data, error } = await supabase
    .from('machines')
    .select(columns)
    .eq('serial_number', code)
    .maybeSingle();
  if (error) throw new Error(`Machine lookup failed: ${error.message}`);
  return data as ScanMachine | null;
}

function matchesMachineType(jobTitle: string | null, machineType: string): boolean {
  if (!jobTitle) return false;
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return normalize(jobTitle).includes(normalize(machineType));
}

async function readQualifiedPersonnel(machineType: string) {
  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error('Supabase service credentials are not configured');
  }

  const params = new URLSearchParams({
    select: 'emp_code,first_name,surname,job_title,status,medical_expiry,induction_expiry',
    job_title: `ilike.*${machineType}*`,
    status: 'ilike.Active',
    limit: '1000',
  });
  const response = await fetch(`${baseUrl}/rest/v1/personnel?${params}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Privileged personnel lookup failed with HTTP ${response.status}`);
  }
  const parsed = personnelRowsSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Privileged personnel lookup returned an invalid response');
  }
  return parsed.data.filter((person) => matchesMachineType(person.job_title, machineType));
}

function canAccessDepartment(
  employee: {
    role: string;
    department_id: string | null;
    accessible_departments: string[] | null;
  },
  departmentId: string
): boolean {
  return (
    employee.role === 'admin' ||
    employee.department_id === departmentId ||
    employee.accessible_departments?.includes(departmentId) === true
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const departmentId = url.searchParams.get('departmentId') ?? '';
    const machineId = url.searchParams.get('machineId') ?? '';
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal) return jsonError('Authentication required', 401, 'UNAUTHENTICATED');
    if (!principal.employee) return jsonError('Employee record not found', 403, 'NO_EMPLOYEE');
    if (
      !canAccessDepartment(principal.employee, departmentId) ||
      !['admin', 'operator', 'supervisor'].includes(principal.employee.role)
    ) {
      return jsonError('Not authorized for Control Room assignments', 403, 'FORBIDDEN');
    }
    if (
      !z.string().uuid().safeParse(departmentId).success ||
      !z.string().uuid().safeParse(machineId).success
    ) {
      return jsonError('Select a valid machine', 400, 'INVALID_MACHINE');
    }

    const machine = await findMachine(supabase, undefined, machineId);
    if (!machine?.active) {
      return jsonError('Active machine was not found', 404, 'MACHINE_NOT_FOUND');
    }
    const personnel = (await readQualifiedPersonnel(machine.machine_type)).filter((person) => {
      const now = new Date();
      return (
        person.status?.toLowerCase() === 'active' &&
        dateIsCurrent(person.medical_expiry, now) &&
        dateIsCurrent(person.induction_expiry, now)
      );
    });
    const employeeCodes = [...new Set(personnel.map((person) => person.emp_code))];
    const { data: operators, error } = employeeCodes.length
      ? await supabase
          .from('operators')
          .select('id, full_name, employee_code')
          .in('employee_code', employeeCodes)
          .eq('active', true)
          .is('deleted_at', null)
          .order('full_name')
      : { data: [], error: null };
    if (error) throw new Error(`Operator directory lookup failed: ${error.message}`);

    const response = machineOperatorScanResponseSchema.parse({
      stage: 'operators',
      machine: {
        id: machine.id,
        name: machine.name,
        machineType: machine.machine_type,
        siteId: machine.site_id,
        requiresHourlyLoads: machine.machine_type === 'Dump Truck',
      },
      operators: (operators ?? []).flatMap((operator) => {
        const person = personnel.find((candidate) => candidate.emp_code === operator.employee_code);
        return person?.job_title
          ? [{ id: operator.id, name: operator.full_name, jobTitle: person.job_title }]
          : [];
      }),
    });
    return NextResponse.json(response);
  } catch (error) {
    logError(error, { context: 'control_room_machine_operator_options' });
    return jsonError('Eligible operators could not be loaded', 500, 'OPTIONS_FAILED');
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const principal = await getAuthenticatedEmployee(supabase);
    if (!principal) return jsonError('Authentication required', 401, 'UNAUTHENTICATED');
    if (!principal.employee) return jsonError('Employee record not found', 403, 'NO_EMPLOYEE');

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) {
      return jsonError('Request body too large', 413, 'BODY_TOO_LARGE');
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError('Malformed JSON', 400, 'MALFORMED_JSON');
    }
    const parsed = machineOperatorScanRequestSchema.safeParse(body);
    if (!parsed.success) return jsonError('Invalid scanner request', 400, 'INVALID_REQUEST');
    const input = parsed.data;

    const employee = principal.employee;
    if (
      !canAccessDepartment(employee, input.departmentId) ||
      !['admin', 'operator', 'supervisor'].includes(employee.role)
    ) {
      return jsonError('Not authorized for Control Room assignments', 403, 'FORBIDDEN');
    }

    const machine = await findMachine(supabase, input.machineCode, input.machineId);
    if (!machine?.active) {
      return jsonError('Active machine was not found for this scan', 404, 'MACHINE_NOT_FOUND');
    }

    const machineDto = {
      id: machine.id,
      name: machine.name,
      machineType: machine.machine_type,
      siteId: machine.site_id,
      requiresHourlyLoads: machine.machine_type === 'Dump Truck',
    };

    if (!input.operatorCode && !input.operatorId) {
      const preview = machineOperatorScanResponseSchema.parse({
        stage: 'machine',
        machine: machineDto,
      });
      return NextResponse.json(preview);
    }

    let person: z.infer<typeof personnelRowsSchema.element> | undefined;
    let badgeValid = false;
    let selectedOperator: { id: string; full_name: string; employee_code: string } | null = null;
    if (input.operatorCode) {
      const [qrBadge] = await readServiceRows(
        'badges',
        'is_active,entity_type,personnel_id,expires_at',
        'qr_code',
        input.operatorCode,
        badgeRowsSchema.element
      );
      const [rfidBadge] = qrBadge
        ? [undefined]
        : await readServiceRows(
            'badges',
            'is_active,entity_type,personnel_id,expires_at',
            'rfid_code',
            input.operatorCode,
            badgeRowsSchema.element
          );
      const badge = qrBadge ?? rfidBadge;
      if (
        !badge?.is_active ||
        badge.entity_type !== 'personnel' ||
        !badge.personnel_id ||
        (badge.expires_at && !dateIsCurrent(badge.expires_at, new Date()))
      ) {
        return jsonError(
          'Operator badge is invalid, expired, or not personnel',
          403,
          'BADGE_INVALID'
        );
      }
      badgeValid = true;
      [person] = await readServiceRows(
        'personnel',
        'emp_code,first_name,surname,job_title,status,medical_expiry,induction_expiry',
        'id',
        badge.personnel_id,
        personnelRowsSchema.element
      );
    } else if (input.operatorId) {
      const { data, error } = await supabase
        .from('operators')
        .select('id, full_name, employee_code')
        .eq('id', input.operatorId)
        .eq('active', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw new Error(`Operator directory lookup failed: ${error.message}`);
      selectedOperator = data;
      if (!selectedOperator) {
        return jsonError('Selected operator is not active', 403, 'OPERATOR_INACTIVE');
      }
      [person] = await readServiceRows(
        'personnel',
        'emp_code,first_name,surname,job_title,status,medical_expiry,induction_expiry',
        'emp_code',
        selectedOperator.employee_code,
        personnelRowsSchema.element
      );
    }
    const now = new Date();
    if (person?.status?.toLowerCase() !== 'active') {
      return jsonError('Personnel record is not active', 403, 'OPERATOR_INACTIVE');
    }
    if (!matchesMachineType(person.job_title, machine.machine_type)) {
      return jsonError(
        `Operator job title does not match ${machine.machine_type}`,
        403,
        'MACHINE_TYPE_MISMATCH'
      );
    }
    const medicalValid = dateIsCurrent(person.medical_expiry, now);
    const inductionValid = dateIsCurrent(person.induction_expiry, now);
    if (!medicalValid || !inductionValid) {
      return jsonError(
        `Assignment blocked: ${[
          !medicalValid ? 'medical clearance missing or expired' : null,
          !inductionValid ? 'induction missing or expired' : null,
        ]
          .filter(Boolean)
          .join(' and ')}`,
        403,
        'OPERATOR_NOT_CLEARED'
      );
    }

    const { data: operator, error: operatorError } = selectedOperator
      ? { data: selectedOperator, error: null }
      : await supabase
          .from('operators')
          .select('id, full_name, employee_code')
          .eq('employee_code', person.emp_code)
          .eq('active', true)
          .is('deleted_at', null)
          .maybeSingle();
    if (operatorError)
      throw new Error(`Operator directory lookup failed: ${operatorError.message}`);
    if (!operator) {
      return jsonError(
        'Personnel badge has no active Control Room operator record',
        403,
        'OPERATOR_NOT_REGISTERED'
      );
    }

    const siteId = machine.site_id ?? input.siteId ?? null;
    if (!siteId) {
      return jsonError('Select a site before assigning this machine', 422, 'SITE_REQUIRED');
    }
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (siteError) throw new Error(`Site lookup failed: ${siteError.message}`);
    if (!site) return jsonError('Selected site is not active or accessible', 403, 'SITE_INVALID');

    const shiftDate = getOperationalToday('Africa/Johannesburg');
    const shiftType = getCurrentShift(now, 'Africa/Johannesburg');
    const { data: currentOperation, error: currentOperationError } = await supabase
      .from('machine_operations')
      .select('id, operator_id, site_id')
      .eq('department_id', input.departmentId)
      .eq('machine_id', machine.id)
      .eq('shift_date', shiftDate)
      .eq('shift_type', shiftType)
      .is('end_time', null)
      .limit(1)
      .maybeSingle();
    if (currentOperationError) {
      throw new Error(`Current machine assignment lookup failed: ${currentOperationError.message}`);
    }
    if (currentOperation) {
      if (currentOperation.operator_id === operator.id && currentOperation.site_id === siteId) {
        const alreadyAssigned = machineOperatorScanResponseSchema.parse({
          stage: 'assignment',
          machine: machineDto,
          operator: { id: operator.id, name: operator.full_name },
          operationId: currentOperation.id,
          assignedAt: now.toISOString(),
          alreadyAssigned: true,
          checks: {
            machineActive: true,
            badgeValid,
            badgeScanned: badgeValid,
            operatorActive: true,
            medicalValid: true,
            inductionValid: true,
            machineQualification: 'not_configured',
          },
        });
        return NextResponse.json(alreadyAssigned);
      }
      return jsonError(
        'Machine already has an active operator this shift',
        409,
        'MACHINE_ASSIGNED'
      );
    }

    const { data: operation, error: insertError } = await supabase
      .from('machine_operations')
      .insert({
        department_id: input.departmentId,
        machine_id: machine.id,
        operator_id: operator.id,
        site_id: siteId,
        shift_date: shiftDate,
        shift_type: shiftType,
        start_time: operationalTime(now),
        created_by: employee.id,
      })
      .select('id')
      .single();
    if (insertError) {
      if (insertError.code === '23505') {
        return jsonError(
          'Machine assignment conflicts with an existing shift record',
          409,
          'DUPLICATE'
        );
      }
      throw new Error(`Machine assignment insert failed: ${insertError.message}`);
    }

    const result = machineOperatorScanResponseSchema.parse({
      stage: 'assignment',
      machine: machineDto,
      operator: { id: operator.id, name: operator.full_name },
      operationId: operation.id,
      assignedAt: now.toISOString(),
      alreadyAssigned: false,
      checks: {
        machineActive: true,
        badgeValid,
        badgeScanned: badgeValid,
        operatorActive: true,
        medicalValid: true,
        inductionValid: true,
        machineQualification: 'not_configured',
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logError(error, { context: 'control_room_machine_operator_scan' });
    return jsonError('Machine/operator scan could not be processed', 500, 'SCAN_FAILED');
  }
}
