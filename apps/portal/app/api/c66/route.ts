import { timingSafeEqual } from 'node:crypto';
import {
  type ScannerBadgeInput,
  type ScannerPayloadInput,
  scannerPayloadSchema,
} from '@repo/contract';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { withBodyLimit } from '@/lib/api/body-limit';
import { applyCors } from '@/lib/api/cors';
import { validateBody } from '@/lib/api/response';
import { logError } from '@/lib/errors/error-logger';

const MAX_BODY_SIZE_BYTES = 65536;
const DEFAULT_SCANNER_SOURCE = 'C66-SCANNER';
const DEFAULT_DIRECTION = 'IN';
const DEFAULT_ALCOHOL_STATUS = 'Approved';
const REVALIDATE_TAG_NAME = 'access-control';
const UNKNOWN_BADGE_NAME = 'Unrecognized Badge / RFID';
const UNKNOWN_BADGE_DENIAL = 'DENIED - Unrecognized Badge / RFID';

const STATUS_OK = 200;
const STATUS_NO_CONTENT = 204;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_INTERNAL_SERVER_ERROR = 500;

const ALLOWED_SCANNER_SOURCES: readonly string[] = process.env.ALLOWED_SCANNER_SOURCES?.split(
  ','
).map((sourceIdentifier) => sourceIdentifier.trim()) ?? [
  'C66-HARDWARE',
  'C66-SCANNER',
  'GATE-TERMINAL',
];

interface LogAccessOptions {
  readonly badgeId: string | null;
  readonly entityType: string;
  readonly denialReason: string | null;
  readonly gateLocation: string;
  readonly isAccessGranted: boolean;
  readonly departmentId?: string | null;
  readonly direction?: string;
  readonly deviceId?: string | null;
  readonly operator?: string | null;
  readonly alcoholTested?: string;
  readonly scannedAt?: string | number | null;
}

interface ProcessScanOptions {
  readonly scanRecord: ScannerBadgeInput;
  readonly defaultSource: string;
  readonly defaultDeviceId: string | null;
}

interface ScanProcessResult {
  readonly isSuccess: boolean;
  readonly httpStatus: number;
  readonly entityName: string;
  readonly entityType: string | null;
  readonly message: string;
  readonly errorMessage?: string;
}

export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: STATUS_NO_CONTENT });
  return applyCors(request, response);
}

export async function POST(request: Request) {
  return withBodyLimit(
    request,
    async () => {
      const response = await handlePost(request);
      return applyCors(request, response);
    },
    { maxSize: MAX_BODY_SIZE_BYTES }
  );
}

function tokensMatchConstantTime(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

async function handlePost(request: Request): Promise<NextResponse> {
  try {
    const rawSourceHeader = request.headers.get('x-scanner-source');
    const sourceIdentifier = rawSourceHeader ? rawSourceHeader.trim() : DEFAULT_SCANNER_SOURCE;

    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
    const tokenHeader = request.headers.get('x-scanner-token')?.trim();
    const receivedToken = tokenHeader || bearerToken || null;
    const expectedToken = process.env.SCANNER_API_KEY?.trim();

    if (
      !expectedToken ||
      !receivedToken ||
      !tokensMatchConstantTime(receivedToken, expectedToken)
    ) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized scanner token' },
        { status: STATUS_UNAUTHORIZED }
      );
    }

    if (!ALLOWED_SCANNER_SOURCES.includes(sourceIdentifier)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized scanner source' },
        { status: STATUS_FORBIDDEN }
      );
    }

    const validationResult = await validateBody(request, scannerPayloadSchema);
    if (validationResult instanceof NextResponse) {
      return validationResult;
    }

    const supabase = createServiceRoleClient();
    const payloadInput = validationResult.data as ScannerPayloadInput;
    const defaultDeviceId = request.headers.get('x-device-id') || null;

    const isBatchPayload =
      Array.isArray(payloadInput) ||
      (typeof payloadInput === 'object' && payloadInput !== null && 'scans' in payloadInput);

    const scanRecords: readonly ScannerBadgeInput[] = Array.isArray(payloadInput)
      ? payloadInput
      : typeof payloadInput === 'object' && payloadInput !== null && 'scans' in payloadInput
        ? payloadInput.scans
        : [payloadInput as ScannerBadgeInput];

    if (!isBatchPayload) {
      const singleScanRecord = scanRecords[0] ?? (payloadInput as ScannerBadgeInput);
      const singleScanResult = await processSingleScan(supabase, {
        scanRecord: singleScanRecord,
        defaultSource: sourceIdentifier,
        defaultDeviceId,
      });

      const responseBody: Record<string, unknown> = {
        success: singleScanResult.isSuccess,
        name: singleScanResult.entityName,
        message: singleScanResult.message,
      };

      if (singleScanResult.entityType) {
        responseBody.entity_type = singleScanResult.entityType;
      }
      if (singleScanResult.errorMessage) {
        responseBody.error = singleScanResult.errorMessage;
      }

      return NextResponse.json(responseBody, { status: singleScanResult.httpStatus });
    }

    const scanResults: ScanProcessResult[] = [];
    for (const currentRecord of scanRecords) {
      const currentResult = await processSingleScan(supabase, {
        scanRecord: currentRecord,
        defaultSource: sourceIdentifier,
        defaultDeviceId,
      });
      scanResults.push(currentResult);
    }

    const allSuccessful = scanResults.every((res) => res.isSuccess);
    return NextResponse.json(
      {
        success: allSuccessful,
        processed: scanResults.length,
        results: scanResults.map((res) => ({
          success: res.isSuccess,
          name: res.entityName,
          entity_type: res.entityType,
          message: res.message,
          status: res.httpStatus,
          ...(res.errorMessage ? { error: res.errorMessage } : {}),
        })),
      },
      { status: STATUS_OK }
    );
  } catch (error) {
    logError(error, {
      url: '/api/c66',
      method: 'POST',
    });
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: STATUS_INTERNAL_SERVER_ERROR }
    );
  }
}

async function processSingleScan(
  supabase: ReturnType<typeof createServiceRoleClient>,
  options: ProcessScanOptions
): Promise<ScanProcessResult> {
  const { scanRecord, defaultSource, defaultDeviceId } = options;

  const rawCode = (
    scanRecord.code ||
    scanRecord.qr_code ||
    scanRecord.rfid_code ||
    scanRecord.barcode ||
    scanRecord.barcodeData ||
    scanRecord.data ||
    scanRecord.tag ||
    scanRecord.epc ||
    scanRecord.uid ||
    ''
  ).trim();

  if (!rawCode) {
    return {
      isSuccess: false,
      httpStatus: STATUS_BAD_REQUEST,
      entityName: UNKNOWN_BADGE_NAME,
      entityType: null,
      message: 'Empty code payload',
      errorMessage: 'Empty code payload',
    };
  }

  const gateLocation =
    scanRecord.gate_location || (scanRecord as Record<string, any>).gate || defaultSource;
  const scanDirection = scanRecord.direction || DEFAULT_DIRECTION;
  const deviceIdentifier = scanRecord.device_id || scanRecord.scanner_id || defaultDeviceId;
  const operatorIdentifier = scanRecord.operator || null;
  const alcoholTestedResult = scanRecord.alcohol_tested || DEFAULT_ALCOHOL_STATUS;
  const recordTimestamp = scanRecord.scanned_at || null;

  const badgeQuery = supabase
    .from('badges')
    .select(
      'id, is_active, entity_type, personnel_id, visitor_id, fleet_id, equipment_id, expires_at, department_id'
    );

  const badgeLookupResponse =
    typeof (badgeQuery as any).or === 'function'
      ? await (badgeQuery as any).or(`qr_code.eq.${rawCode},rfid_code.eq.${rawCode}`).maybeSingle()
      : await (badgeQuery as any).eq('qr_code', rawCode).single();

  const matchedBadge = badgeLookupResponse?.data;
  const badgeLookupError = badgeLookupResponse?.error;

  if (badgeLookupError || !matchedBadge) {
    await logAccess(supabase, {
      badgeId: null,
      entityType: 'UNKNOWN',
      denialReason: UNKNOWN_BADGE_DENIAL,
      gateLocation,
      isAccessGranted: false,
      departmentId: null,
      direction: scanDirection,
      deviceId: deviceIdentifier,
      operator: operatorIdentifier,
      alcoholTested: alcoholTestedResult,
      scannedAt: recordTimestamp,
    });

    return {
      isSuccess: false,
      httpStatus: STATUS_NOT_FOUND,
      entityName: UNKNOWN_BADGE_NAME,
      entityType: null,
      message: UNKNOWN_BADGE_DENIAL,
    };
  }

  if (!matchedBadge.is_active) {
    await logAccess(supabase, {
      badgeId: matchedBadge.id,
      entityType: matchedBadge.entity_type,
      denialReason: 'DENIED - Badge Revoked',
      gateLocation,
      isAccessGranted: false,
      departmentId: matchedBadge.department_id,
      direction: scanDirection,
      deviceId: deviceIdentifier,
      operator: operatorIdentifier,
      alcoholTested: alcoholTestedResult,
      scannedAt: recordTimestamp,
    });

    return {
      isSuccess: false,
      httpStatus: STATUS_FORBIDDEN,
      entityName: 'Revoked Badge',
      entityType: matchedBadge.entity_type,
      message: 'DENIED - Badge Revoked',
    };
  }

  if (matchedBadge.expires_at && new Date(matchedBadge.expires_at) < new Date()) {
    await logAccess(supabase, {
      badgeId: matchedBadge.id,
      entityType: matchedBadge.entity_type,
      denialReason: 'DENIED - Credential Expired',
      gateLocation,
      isAccessGranted: false,
      departmentId: matchedBadge.department_id,
      direction: scanDirection,
      deviceId: deviceIdentifier,
      operator: operatorIdentifier,
      alcoholTested: alcoholTestedResult,
      scannedAt: recordTimestamp,
    });

    return {
      isSuccess: false,
      httpStatus: STATUS_FORBIDDEN,
      entityName: 'Expired Credential',
      entityType: matchedBadge.entity_type,
      message: 'DENIED - Credential Expired',
    };
  }

  let resolvedEntityName = 'Unknown Entity';
  let isAccessGranted = true;
  let accessDenialReason: string | null = null;

  if (matchedBadge.entity_type === 'personnel' && matchedBadge.personnel_id) {
    const { data: personnelRecord } = await supabase
      .from('personnel')
      .select('first_name, surname, emp_code, status, induction_expiry, medical_expiry')
      .eq('id', matchedBadge.personnel_id)
      .single();

    if (personnelRecord) {
      resolvedEntityName = personnelRecord.emp_code
        ? `${personnelRecord.first_name} ${personnelRecord.surname} (${personnelRecord.emp_code})`
        : `${personnelRecord.first_name} ${personnelRecord.surname}`;

      if (personnelRecord.status !== 'Active') {
        isAccessGranted = false;
        accessDenialReason = `DENIED - Personnel Status: ${personnelRecord.status}`;
      } else if (
        personnelRecord.induction_expiry &&
        new Date(personnelRecord.induction_expiry) < new Date()
      ) {
        isAccessGranted = false;
        accessDenialReason = 'DENIED - Induction Expired';
      } else if (
        personnelRecord.medical_expiry &&
        new Date(personnelRecord.medical_expiry) < new Date()
      ) {
        isAccessGranted = false;
        accessDenialReason = 'DENIED - Medical Clearance Expired';
      }
    }
  } else if (matchedBadge.entity_type === 'visitor' && matchedBadge.visitor_id) {
    const { data: visitorRecord } = await supabase
      .from('visitors')
      .select('first_name, surname, company, status')
      .eq('id', matchedBadge.visitor_id)
      .single();

    if (visitorRecord) {
      resolvedEntityName = `${visitorRecord.first_name} ${visitorRecord.surname} (${visitorRecord.company || 'Visitor'})`;
      if (visitorRecord.status !== 'Checked In') {
        isAccessGranted = false;
        accessDenialReason = `DENIED - Visitor Status: ${visitorRecord.status}`;
      }
    }
  } else if (
    (matchedBadge.entity_type === 'vehicle' || matchedBadge.entity_type === 'fleet') &&
    matchedBadge.fleet_id
  ) {
    const { data: fleetRecord } = await supabase
      .from('fleet')
      .select('fleet_code, vehicle_type, registration_number, make, model, status')
      .eq('id', matchedBadge.fleet_id)
      .single();

    if (fleetRecord) {
      const isCoalTruck = fleetRecord.vehicle_type?.toLowerCase().includes('coal');
      const vehicleCategory = isCoalTruck ? 'Coal Truck' : fleetRecord.vehicle_type || 'Vehicle';
      resolvedEntityName =
        `${vehicleCategory}: ${fleetRecord.fleet_code} [${fleetRecord.registration_number || 'No Plate'}] (${fleetRecord.make || ''} ${fleetRecord.model || ''})`.trim();
      if (fleetRecord.status !== 'Active') {
        isAccessGranted = false;
        accessDenialReason = `DENIED - Vehicle Status: ${fleetRecord.status}`;
      }
    }
  } else if (matchedBadge.entity_type === 'equipment' && matchedBadge.equipment_id) {
    const { data: equipmentRecord } = await supabase
      .from('equipment')
      .select('equip_code, equipment_type, status, calibration_expiry')
      .eq('id', matchedBadge.equipment_id)
      .single();

    if (equipmentRecord) {
      resolvedEntityName = `Equipment: ${equipmentRecord.equip_code} (${equipmentRecord.equipment_type})`;
      if (equipmentRecord.status !== 'Active') {
        isAccessGranted = false;
        accessDenialReason = `DENIED - Equipment Status: ${equipmentRecord.status}`;
      } else if (
        equipmentRecord.calibration_expiry &&
        new Date(equipmentRecord.calibration_expiry) < new Date()
      ) {
        isAccessGranted = false;
        accessDenialReason = 'DENIED - Calibration Expired';
      }
    }
  }

  await logAccess(supabase, {
    badgeId: matchedBadge.id,
    entityType: matchedBadge.entity_type,
    denialReason: isAccessGranted ? null : accessDenialReason,
    gateLocation,
    isAccessGranted,
    departmentId: matchedBadge.department_id,
    direction: scanDirection,
    deviceId: deviceIdentifier,
    operator: operatorIdentifier,
    alcoholTested: alcoholTestedResult,
    scannedAt: recordTimestamp,
  });

  return {
    isSuccess: isAccessGranted,
    httpStatus: STATUS_OK,
    entityName: resolvedEntityName,
    entityType: matchedBadge.entity_type,
    message: isAccessGranted ? `Access Granted - ${gateLocation}` : (accessDenialReason ?? ''),
  };
}

function resolveScannedAt(deviceScannedAt?: string | number | null): string {
  if (!deviceScannedAt) {
    return new Date().toISOString();
  }
  const parsedDate = new Date(deviceScannedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString();
  }
  return parsedDate.toISOString();
}

async function logAccess(
  supabase: ReturnType<typeof createServiceRoleClient>,
  options: LogAccessOptions
): Promise<void> {
  const insertPayload = {
    badge_id: options.badgeId,
    access_type: options.entityType,
    direction: options.direction ?? DEFAULT_DIRECTION,
    gate_location: options.gateLocation,
    access_granted: options.isAccessGranted,
    denial_reason: options.denialReason,
    department_id: options.departmentId ?? null,
    alcohol_tested: options.alcoholTested ?? DEFAULT_ALCOHOL_STATUS,
    operator: options.operator ?? null,
    device_id: options.deviceId ?? null,
    scanned_at: resolveScannedAt(options.scannedAt),
  };

  const { error } = await supabase.from('access_logs').insert([insertPayload]);

  if (error) {
    logError(new Error(error.message), {
      url: '/api/c66',
      context: 'access_log_write_failed',
    });
    return;
  }

  revalidateTag(REVALIDATE_TAG_NAME, 'max');
}
