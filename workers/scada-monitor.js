/**
 * Cloudflare Workers ES Module for Arch-System SCADA Edge Telemetry.
 *
 * Enforces a strict read-only industrial safety boundary, HMAC-SHA256 ingest
 * verification, streaming UTF-8 byte-size limits, and sharded Durable Object
 * state coordination via `AgentCoordinator`.
 */

const SERVICE_NAME = 'arch-system-scada-monitor';
const SERVICE_ROLE = 'edge-scada-telemetry';
const COORDINATOR_INSTANCE_NAME = 'primary-scada-coordinator';
const EDGE_META_KEY = 'scada:edge:meta';
const EDGE_INDEX_KEY = 'scada:edge:index';
const SENSOR_KEY_PREFIX = 'sensor:';
const REPLAY_DIGEST_PREFIX = 'sig:';

const MODE_DURABLE_OBJECT = 'durable-object';
const MODE_STANDALONE = 'standalone';

const STATUS_HEALTHY = 'healthy';
const STATUS_DEGRADED = 'degraded';

const DEFAULT_STALE_THRESHOLD_MS = 60_000;
const REPLAY_WINDOW_MS = 300_000;
const MS_PER_SECOND = 1_000;
const EPOCH_SECONDS_THRESHOLD = 1e12;
const MAX_UPLOAD_BYTES = 1 * 1024 * 1024;
const MAX_TRACKED_SENSORS = 500;
const MAX_IDEMPOTENCY_KEYS = 2_000;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_METRICS_PER_PAYLOAD = 64;
const MAX_METRIC_STRING_LENGTH = 512;
const MAX_INSPECT_DEPTH = 32;
const SHA256_HEX_LENGTH = 64;
const HEX_RADIX = 16;
const HEX_PAD_WIDTH = 2;
const SIGNATURE_PREFIX = 'sha256=';
const DEFAULT_SITE_ID = 'default';
const UNKNOWN_GEO_COUNTRY = 'UNKNOWN';
const WEBSOCKET_PROTOCOL_HEADER = 'websocket';
const WEBSOCKET_CLOSE_POLICY_VIOLATION = 1008;
const INTERNAL_ORIGIN = 'https://coordinator.internal';

const HTTP_OK = 200;
const HTTP_ACCEPTED = 202;
const HTTP_SWITCHING_PROTOCOLS = 101;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_UPGRADE_REQUIRED = 426;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_NOT_IMPLEMENTED = 501;
const HTTP_SERVICE_UNAVAILABLE = 503;

const HEADER_CONTENT_TYPE = 'content-type';
const HEADER_CONTENT_LENGTH = 'content-length';
const HEADER_REQUEST_ID = 'x-request-id';
const HEADER_SIGNATURE = 'x-arch-signature-256';
const HEADER_TIMESTAMP = 'x-arch-timestamp';
const HEADER_IDEMPOTENCY_KEY = 'x-idempotency-key';
const HEADER_REPLAY_KEY = 'x-arch-replay-key';
const HEADER_COORDINATOR_MODE = 'x-arch-coordinator-mode';
const HEADER_UPGRADE = 'upgrade';
const HEADER_CF_IPCOUNTRY = 'cf-ipcountry';
const CONTENT_TYPE_JSON = 'application/json';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]+$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/;
const DIGITS_ONLY_PATTERN = /^\d+$/;
const KEY_NORMALIZE_PATTERN = /[-_\s]/g;

const ROUTE_ROOT = '/';
const ROUTE_HEALTH = '/health';
const ROUTE_STATUS = '/status';
const ROUTE_HEARTBEAT = '/telemetry/heartbeat';
const ROUTE_UPLOAD = '/upload';
const ROUTE_SUMMARY = '/telemetry/summary';
const ROUTE_GEO = '/geo';
const ROUTE_WS = '/ws';

const PUBLIC_ROUTES = [
  ROUTE_ROOT,
  ROUTE_HEALTH,
  ROUTE_STATUS,
  ROUTE_HEARTBEAT,
  ROUTE_UPLOAD,
  ROUTE_SUMMARY,
  ROUTE_GEO,
  ROUTE_WS,
];

const RESERVED_TELEMETRY_KEYS = new Set(['sensorId', 'siteId', 'timestamp', 'metrics']);

const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

// cspell:ignore writetag controlwrite plccommand setpointwrite actuatorcommand modbuswrite opcwrite opcuawrite coilwrite registerwrite forcecoil writecoil writeregister emergencyoverride
const FORBIDDEN_NORMALIZED_CONTROL_KEYS = new Set([
  'command',
  'commands',
  'writetag',
  'controlwrite',
  'plccommand',
  'setpointwrite',
  'actuatorcommand',
  'modbuswrite',
  'opcwrite',
  'opcuawrite',
  'coilwrite',
  'registerwrite',
  'forcecoil',
  'writecoil',
  'writeregister',
  'emergencyoverride',
]);

const ROUTE_METHODS = {
  [ROUTE_ROOT]: new Set(['GET']),
  [ROUTE_HEALTH]: new Set(['GET']),
  [ROUTE_STATUS]: new Set(['GET']),
  [ROUTE_HEARTBEAT]: new Set(['POST']),
  [ROUTE_UPLOAD]: new Set(['POST']),
  [ROUTE_SUMMARY]: new Set(['GET']),
  [ROUTE_GEO]: new Set(['GET']),
  [ROUTE_WS]: new Set(['GET']),
};

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: false });

/**
 * Resolves a safe request ID from inbound headers or generates a fresh UUID.
 *
 * @param {Request} request
 * @returns {string}
 */
function resolveRequestId(request) {
  try {
    const inboundId = request?.headers?.get?.(HEADER_REQUEST_ID)?.trim();
    if (inboundId && REQUEST_ID_PATTERN.test(inboundId)) {
      return inboundId;
    }
  } catch {
    // Fall through to fresh UUID when synthetic requests fail header access.
  }
  return crypto.randomUUID();
}

/**
 * Builds standard security headers attached to every worker response.
 *
 * @param {string} requestId
 * @returns {Record<string, string>}
 */
function buildBaseSecurityHeaders(requestId) {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
    [HEADER_REQUEST_ID]: requestId,
  };
}

/**
 * Creates a JSON response with mandatory security headers.
 *
 * @param {object} options
 * @param {unknown} options.payload
 * @param {number} [options.status]
 * @param {string} options.requestId
 * @param {Record<string, string>} [options.extraHeaders]
 * @returns {Response}
 */
function createJsonResponse(options) {
  const { payload, status = HTTP_OK, requestId, extraHeaders = {} } = options;
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      [HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
      ...buildBaseSecurityHeaders(requestId),
      ...extraHeaders,
    },
  });
}

/**
 * Parses the configured stale sensor threshold in milliseconds.
 *
 * @param {Record<string, unknown>} [env]
 * @returns {number}
 */
function resolveStaleThresholdMs(env) {
  const rawThreshold = env?.SCADA_STALE_THRESHOLD_MS;
  if (typeof rawThreshold === 'number' && Number.isFinite(rawThreshold) && rawThreshold > 0) {
    return rawThreshold;
  }
  if (typeof rawThreshold === 'string') {
    const parsedThreshold = Number.parseInt(rawThreshold, 10);
    if (Number.isFinite(parsedThreshold) && parsedThreshold > 0) {
      return parsedThreshold;
    }
  }
  return DEFAULT_STALE_THRESHOLD_MS;
}

/**
 * Checks whether a value is a plain JSON object without custom prototypes.
 *
 * @param {unknown} candidate
 * @returns {candidate is Record<string, unknown>}
 */
function isPlainObject(candidate) {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(candidate);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Guards against prototype-pollution and Object.prototype shadow keys.
 *
 * @param {unknown} keyCandidate
 * @returns {keyCandidate is string}
 */
function isSafeObjectKey(keyCandidate) {
  return (
    typeof keyCandidate === 'string' &&
    keyCandidate.length > 0 &&
    keyCandidate.length <= MAX_IDENTIFIER_LENGTH &&
    !FORBIDDEN_OBJECT_KEYS.has(keyCandidate)
  );
}

/**
 * Checks whether a key matches any normalized PLC or actuator control-write field.
 *
 * @param {string} rawKey
 * @returns {boolean}
 */
function isForbiddenControlKey(rawKey) {
  const normalizedKey = rawKey.replace(KEY_NORMALIZE_PATTERN, '').toLowerCase();
  return FORBIDDEN_NORMALIZED_CONTROL_KEYS.has(normalizedKey);
}

/**
 * Inspects a single object or array node during iterative payload safety traversal.
 *
 * @param {unknown} node
 * @param {number} depth
 * @param {Array<{ node: unknown, depth: number }>} stack
 * @returns {{ matchedKey: string | null, depthExceeded: boolean }}
 */
function inspectPayloadNode(node, depth, stack) {
  if (depth > MAX_INSPECT_DEPTH) {
    return { matchedKey: null, depthExceeded: true };
  }
  if (Array.isArray(node)) {
    for (const element of node) {
      stack.push({ node: element, depth: depth + 1 });
    }
    return { matchedKey: null, depthExceeded: false };
  }
  if (!isPlainObject(node)) {
    return { matchedKey: null, depthExceeded: false };
  }
  for (const [fieldKey, fieldContent] of Object.entries(node)) {
    if (isForbiddenControlKey(fieldKey)) {
      return { matchedKey: fieldKey, depthExceeded: false };
    }
    stack.push({ node: fieldContent, depth: depth + 1 });
  }
  return { matchedKey: null, depthExceeded: false };
}

/**
 * Iteratively checks JSON payloads for prohibited PLC/control write keys and max depth.
 *
 * @param {unknown} rootCandidate
 * @returns {{ safe: true } | { safe: false, reason: 'control_write' | 'depth_exceeded', field?: string }}
 */
function inspectPayloadSafety(rootCandidate) {
  const stack = [{ node: rootCandidate, depth: 0 }];
  while (stack.length > 0) {
    const currentFrame = stack.pop();
    if (!currentFrame) {
      continue;
    }
    const inspection = inspectPayloadNode(currentFrame.node, currentFrame.depth, stack);
    if (inspection.depthExceeded) {
      return { safe: false, reason: 'depth_exceeded' };
    }
    if (inspection.matchedKey) {
      return { safe: false, reason: 'control_write', field: inspection.matchedKey };
    }
  }
  return { safe: true };
}

/**
 * Validates that a candidate metric reading is a bounded primitive.
 *
 * @param {unknown} candidate
 * @returns {boolean}
 */
function isValidMetricPrimitive(candidate) {
  if (typeof candidate === 'number') {
    return Number.isFinite(candidate);
  }
  if (typeof candidate === 'boolean') {
    return true;
  }
  return typeof candidate === 'string' && candidate.length <= MAX_METRIC_STRING_LENGTH;
}

/**
 * Rejects disallowed top-level keys or prototype-pollution keys on parsed payloads.
 *
 * @param {Record<string, unknown>} parsedBody
 * @param {boolean} hasMetricsField
 * @returns {string | null}
 */
function validateTopLevelObjectKeys(parsedBody, hasMetricsField) {
  for (const topKey of Object.keys(parsedBody)) {
    if (!isSafeObjectKey(topKey)) {
      return `Disallowed payload key "${topKey}"`;
    }
    if (hasMetricsField && !RESERVED_TELEMETRY_KEYS.has(topKey)) {
      return `Unexpected top-level field "${topKey}" when "metrics" object is provided`;
    }
  }
  return null;
}

/**
 * Extracts and validates sensor metrics from either `metrics` or top-level upload fields.
 *
 * @param {Record<string, unknown>} parsedBody
 * @returns {{ ok: true, metrics: Record<string, number | boolean | string> } | { ok: false, error: string }}
 */
function extractValidatedMetrics(parsedBody) {
  const hasMetricsField = Object.hasOwn(parsedBody, 'metrics');
  const topKeyError = validateTopLevelObjectKeys(parsedBody, hasMetricsField);
  if (topKeyError) {
    return { ok: false, error: topKeyError };
  }
  if (hasMetricsField && !isPlainObject(parsedBody.metrics)) {
    return { ok: false, error: 'Field "metrics" must be a plain JSON object' };
  }

  const rawEntries = hasMetricsField
    ? Object.entries(parsedBody.metrics)
    : Object.entries(parsedBody).filter(([fieldKey]) => !RESERVED_TELEMETRY_KEYS.has(fieldKey));

  if (rawEntries.length === 0 || rawEntries.length > MAX_METRICS_PER_PAYLOAD) {
    return {
      ok: false,
      error: `Telemetry payload must include 1 to ${MAX_METRICS_PER_PAYLOAD} metrics`,
    };
  }

  const normalizedMetrics = Object.create(null);
  for (const [metricKey, metricReading] of rawEntries) {
    if (!isSafeObjectKey(metricKey) || !IDENTIFIER_PATTERN.test(metricKey)) {
      return {
        ok: false,
        error: `Metric key "${metricKey}" must be a safe 1-${MAX_IDENTIFIER_LENGTH} char identifier`,
      };
    }
    if (!isValidMetricPrimitive(metricReading)) {
      return {
        ok: false,
        error: `Metric "${metricKey}" must be a finite number, boolean, or string <= ${MAX_METRIC_STRING_LENGTH} chars`,
      };
    }
    Object.defineProperty(normalizedMetrics, metricKey, {
      value: metricReading,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  return { ok: true, metrics: { ...normalizedMetrics } };
}

/**
 * Validates a required or defaulted identifier string.
 *
 * @param {unknown} candidate
 * @returns {candidate is string}
 */
function isValidIdentifier(candidate) {
  return (
    isSafeObjectKey(candidate) &&
    candidate.length <= MAX_IDENTIFIER_LENGTH &&
    IDENTIFIER_PATTERN.test(candidate)
  );
}

/**
 * Validates and normalizes an incoming telemetry heartbeat or upload payload.
 *
 * @param {unknown} parsedBody
 * @returns {{ ok: true, telemetry: { sensorId: string, siteId: string, recordedAtIso: string, metrics: Record<string, number | boolean | string> } } | { ok: false, error: string }}
 */
function validateTelemetryPayload(parsedBody) {
  if (!isPlainObject(parsedBody)) {
    return { ok: false, error: 'Telemetry payload must be a JSON object' };
  }

  const { sensorId, siteId, timestamp } = parsedBody;
  if (!isValidIdentifier(sensorId)) {
    return {
      ok: false,
      error: `Field "sensorId" must be a safe 1-${MAX_IDENTIFIER_LENGTH} char [A-Za-z0-9._:-]+ identifier`,
    };
  }

  const resolvedSiteId = siteId === undefined ? DEFAULT_SITE_ID : siteId;
  if (!isValidIdentifier(resolvedSiteId)) {
    return {
      ok: false,
      error: `Field "siteId" must be a safe 1-${MAX_IDENTIFIER_LENGTH} char [A-Za-z0-9._:-]+ identifier`,
    };
  }

  let recordedAtIso = new Date().toISOString();
  if (timestamp !== undefined) {
    if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) {
      return { ok: false, error: 'Field "timestamp" must be a valid ISO-8601 date string' };
    }
    recordedAtIso = new Date(Date.parse(timestamp)).toISOString();
  }

  const metricsOutcome = extractValidatedMetrics(parsedBody);
  if (!metricsOutcome.ok) {
    return metricsOutcome;
  }

  return {
    ok: true,
    telemetry: {
      sensorId,
      siteId: resolvedSiteId,
      recordedAtIso,
      metrics: metricsOutcome.metrics,
    },
  };
}

/**
 * Parses an authentication timestamp header into epoch milliseconds.
 *
 * @param {string} rawTimestamp
 * @returns {number}
 */
function parseAuthTimestampMs(rawTimestamp) {
  const trimmed = rawTimestamp.trim();
  if (!trimmed) {
    return Number.NaN;
  }
  if (DIGITS_ONLY_PATTERN.test(trimmed)) {
    const numericEpoch = Number(trimmed);
    if (!Number.isFinite(numericEpoch)) {
      return Number.NaN;
    }
    return numericEpoch < EPOCH_SECONDS_THRESHOLD ? numericEpoch * MS_PER_SECOND : numericEpoch;
  }
  return Date.parse(trimmed);
}

/**
 * Compares two equal-length hex strings in constant time.
 *
 * @param {string} leftHex
 * @param {string} rightHex
 * @returns {boolean}
 */
function timingSafeEqualHex(leftHex, rightHex) {
  if (leftHex.length !== rightHex.length) {
    return false;
  }
  let diffMask = 0;
  for (let index = 0; index < leftHex.length; index += 1) {
    diffMask |= leftHex.charCodeAt(index) ^ rightHex.charCodeAt(index);
  }
  return diffMask === 0;
}

/**
 * Computes a lowercase SHA-256 hex digest over UTF-8 text.
 *
 * @param {string} contentText
 * @returns {Promise<string>}
 */
async function sha256Hex(contentText) {
  const digestBuffer = await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(contentText));
  return Array.from(new Uint8Array(digestBuffer))
    .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_PAD_WIDTH, '0'))
    .join('');
}

/**
 * Verifies X-Arch-Signature-256 HMAC-SHA256 over timestamp, idempotency key, and body.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {string} options.rawBody
 * @param {string} options.idempotencyKey
 * @param {string} options.secret
 * @returns {Promise<{ ok: true, replayDigest: string } | { ok: false, error: string }>}
 */
async function verifyIngestSignature(options) {
  const { request, rawBody, idempotencyKey, secret } = options;
  const signatureHeader = request.headers.get(HEADER_SIGNATURE)?.trim() ?? '';
  const timestampHeader = request.headers.get(HEADER_TIMESTAMP)?.trim() ?? '';

  if (!signatureHeader || !timestampHeader) {
    return { ok: false, error: 'Missing required telemetry signature headers' };
  }

  const parsedTimestampMs = parseAuthTimestampMs(timestampHeader);
  if (!Number.isFinite(parsedTimestampMs)) {
    return { ok: false, error: 'Invalid telemetry signature timestamp' };
  }
  if (Math.abs(Date.now() - parsedTimestampMs) > REPLAY_WINDOW_MS) {
    return { ok: false, error: 'Telemetry signature timestamp outside replay window' };
  }
  if (!signatureHeader.toLowerCase().startsWith(SIGNATURE_PREFIX)) {
    return { ok: false, error: 'Invalid telemetry signature format' };
  }

  const providedHex = signatureHeader.slice(SIGNATURE_PREFIX.length).toLowerCase();
  if (providedHex.length !== SHA256_HEX_LENGTH || !HEX_SHA256_PATTERN.test(providedHex)) {
    return { ok: false, error: 'Invalid telemetry signature digest' };
  }

  const canonicalMessage = `${timestampHeader}.${idempotencyKey}.${rawBody}`;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    TEXT_ENCODER.encode(canonicalMessage)
  );
  const expectedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_PAD_WIDTH, '0'))
    .join('');

  if (!timingSafeEqualHex(providedHex, expectedHex)) {
    return { ok: false, error: 'Telemetry HMAC signature verification failed' };
  }

  const replayDigest = await sha256Hex(canonicalMessage);
  return { ok: true, replayDigest };
}

/**
 * Creates an empty edge metadata record.
 *
 * @returns {{ startedAtIso: string, totalHeartbeatsIngested: number, lastHeartbeatAt: string | null, nextOrderSeq: number }}
 */
function createInitialEdgeMeta() {
  return {
    startedAtIso: new Date().toISOString(),
    totalHeartbeatsIngested: 0,
    lastHeartbeatAt: null,
    nextOrderSeq: 1,
  };
}

/**
 * Creates an empty edge index record.
 *
 * @returns {{ sensorIndex: Record<string, { receivedAtMs: number, orderSeq: number }>, recentIdempotencyKeys: Record<string, number> }}
 */
function createInitialEdgeIndex() {
  return {
    sensorIndex: {},
    recentIdempotencyKeys: {},
  };
}

/**
 * Prunes expired idempotency/replay keys and caps total retained keys.
 *
 * @param {Record<string, number>} keysRecord
 * @param {number} nowMs
 * @returns {Record<string, number>}
 */
function pruneIdempotencyKeys(keysRecord, nowMs) {
  const activeEntries = Object.entries(keysRecord).filter(
    ([entryKey, expiresAtMs]) =>
      isSafeObjectKey(entryKey) && typeof expiresAtMs === 'number' && expiresAtMs > nowMs
  );
  if (activeEntries.length <= MAX_IDEMPOTENCY_KEYS) {
    return Object.fromEntries(activeEntries);
  }
  const trimmedEntries = activeEntries
    .sort((left, right) => right[1] - left[1])
    .slice(0, MAX_IDEMPOTENCY_KEYS);
  return Object.fromEntries(trimmedEntries);
}

/**
 * Evicts oldest sensor entries when exceeding MAX_TRACKED_SENSORS, never evicting activeSensorId.
 *
 * @param {object} options
 * @param {Record<string, { receivedAtMs: number, orderSeq: number }>} options.sensorIndex
 * @param {string} options.activeSensorId
 * @returns {{ nextIndex: Record<string, { receivedAtMs: number, orderSeq: number }>, evictedIds: string[] }}
 */
function evictOverflowSensors(options) {
  const { sensorIndex, activeSensorId } = options;
  const entries = Object.entries(sensorIndex);
  if (entries.length <= MAX_TRACKED_SENSORS) {
    return { nextIndex: sensorIndex, evictedIds: [] };
  }

  const evictionCandidates = entries
    .filter(([candidateId]) => candidateId !== activeSensorId)
    .sort((left, right) => {
      const timeDelta = left[1].receivedAtMs - right[1].receivedAtMs;
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return left[1].orderSeq - right[1].orderSeq;
    });

  const overflowCount = entries.length - MAX_TRACKED_SENSORS;
  const evictedIds = evictionCandidates.slice(0, overflowCount).map(([candidateId]) => candidateId);
  const evictedSet = new Set(evictedIds);
  const keptEntries = entries.filter(([candidateId]) => !evictedSet.has(candidateId));

  return { nextIndex: Object.fromEntries(keptEntries), evictedIds };
}

/**
 * Annotates loaded sensor records with `ageMs` and `isStale`.
 *
 * @param {object} options
 * @param {Array<Record<string, unknown>>} options.sensorRecords
 * @param {number} options.staleThresholdMs
 * @param {number} options.nowMs
 * @returns {{ sensorCount: number, staleSensorCount: number, sensors: Array<Record<string, unknown>> }}
 */
function evaluateSensorRecords(options) {
  const { sensorRecords, staleThresholdMs, nowMs } = options;
  const sensors = sensorRecords.map((sensorRecord) => {
    const timestampStr =
      typeof sensorRecord.recordedAtIso === 'string' && sensorRecord.recordedAtIso
        ? sensorRecord.recordedAtIso
        : String(sensorRecord.receivedAtIso ?? '');
    const referenceMs = Date.parse(timestampStr);
    const ageMs = Number.isFinite(referenceMs)
      ? Math.max(0, nowMs - referenceMs)
      : Number.MAX_SAFE_INTEGER;
    return {
      ...sensorRecord,
      ageMs,
      isStale: ageMs > staleThresholdMs,
    };
  });

  const staleSensorCount = sensors.filter((sensorRecord) => sensorRecord.isStale).length;
  return {
    sensorCount: sensors.length,
    staleSensorCount,
    sensors,
  };
}

/**
 * Parses and validates coordinator JSON heartbeat body and enforces read-only safety.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {string} options.requestId
 * @returns {Promise<{ ok: true, telemetry: { sensorId: string, siteId: string, recordedAtIso: string, metrics: Record<string, number | boolean | string> } } | { ok: false, response: Response }>}
 */
async function parseSafeCoordinatorTelemetry(options) {
  const { request, requestId } = options;
  let parsedBody;
  try {
    parsedBody = await request.json();
  } catch {
    return {
      ok: false,
      response: createJsonResponse({
        payload: { error: 'Invalid coordinator JSON payload' },
        status: HTTP_BAD_REQUEST,
        requestId,
      }),
    };
  }

  const safetyOutcome = inspectPayloadSafety(parsedBody);
  if (!safetyOutcome.safe) {
    const status = safetyOutcome.reason === 'control_write' ? HTTP_FORBIDDEN : HTTP_BAD_REQUEST;
    const error =
      safetyOutcome.reason === 'control_write'
        ? 'Industrial safety boundary: control writes are prohibited on edge telemetry workers'
        : `Telemetry payload exceeds maximum nesting depth of ${MAX_INSPECT_DEPTH}`;
    return {
      ok: false,
      response: createJsonResponse({ payload: { error }, status, requestId }),
    };
  }

  const validationOutcome = validateTelemetryPayload(parsedBody);
  if (!validationOutcome.ok) {
    return {
      ok: false,
      response: createJsonResponse({
        payload: { error: validationOutcome.error },
        status: HTTP_BAD_REQUEST,
        requestId,
      }),
    };
  }

  return { ok: true, telemetry: validationOutcome.telemetry };
}

/**
 * Cloudflare Durable Object coordinating sharded SCADA edge telemetry state.
 */
export class AgentCoordinator {
  /**
   * @param {{ storage: { get: (key: string) => Promise<unknown>, put: (key: string, entry: unknown) => Promise<void>, delete?: (key: string) => Promise<unknown> }, isStandalone?: boolean }} state
   * @param {Record<string, unknown>} [env]
   */
  constructor(state, env = {}) {
    this.state = state;
    this.env = env;
    this.routeHandlers = {
      [`GET ${ROUTE_STATUS}`]: (request, requestId) => this.handleStatus(request, requestId),
      [`POST ${ROUTE_HEARTBEAT}`]: (request, requestId) => this.handleHeartbeat(request, requestId),
      [`GET ${ROUTE_SUMMARY}`]: (request, requestId) => this.handleSummary(request, requestId),
    };
  }

  /**
   * Loads coordinator metadata from storage.
   *
   * @returns {Promise<ReturnType<typeof createInitialEdgeMeta>>}
   */
  async loadEdgeMeta() {
    const storedMeta = await this.state.storage.get(EDGE_META_KEY);
    if (!isPlainObject(storedMeta)) {
      return createInitialEdgeMeta();
    }
    return {
      startedAtIso:
        typeof storedMeta.startedAtIso === 'string'
          ? storedMeta.startedAtIso
          : new Date().toISOString(),
      totalHeartbeatsIngested:
        typeof storedMeta.totalHeartbeatsIngested === 'number'
          ? storedMeta.totalHeartbeatsIngested
          : 0,
      lastHeartbeatAt:
        typeof storedMeta.lastHeartbeatAt === 'string' ? storedMeta.lastHeartbeatAt : null,
      nextOrderSeq:
        typeof storedMeta.nextOrderSeq === 'number' && storedMeta.nextOrderSeq >= 1
          ? storedMeta.nextOrderSeq
          : 1,
    };
  }

  /**
   * Loads bounded sensor index and idempotency/replay registry from storage.
   *
   * @returns {Promise<ReturnType<typeof createInitialEdgeIndex>>}
   */
  async loadEdgeIndex() {
    const storedIndex = await this.state.storage.get(EDGE_INDEX_KEY);
    if (!isPlainObject(storedIndex)) {
      return createInitialEdgeIndex();
    }
    return {
      sensorIndex: isPlainObject(storedIndex.sensorIndex) ? storedIndex.sensorIndex : {},
      recentIdempotencyKeys: isPlainObject(storedIndex.recentIdempotencyKeys)
        ? storedIndex.recentIdempotencyKeys
        : {},
    };
  }

  /**
   * Loads all tracked sensor entries from sharded storage keys.
   *
   * @param {Record<string, unknown>} sensorIndex
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  async loadTrackedSensors(sensorIndex) {
    const sensorIds = Object.keys(sensorIndex).filter((sensorId) => isSafeObjectKey(sensorId));
    const records = await Promise.all(
      sensorIds.map((sensorId) => this.state.storage.get(`${SENSOR_KEY_PREFIX}${sensorId}`))
    );
    return records.filter((record) => isPlainObject(record));
  }

  /**
   * Resolves honest execution mode for coordinator responses.
   *
   * @param {Request} request
   * @returns {'durable-object' | 'standalone'}
   */
  resolveExecutionMode(request) {
    const modeHeader = request.headers.get(HEADER_COORDINATOR_MODE);
    if (this.state?.isStandalone || modeHeader === MODE_STANDALONE) {
      return MODE_STANDALONE;
    }
    return MODE_DURABLE_OBJECT;
  }

  /**
   * Handles internal coordinator HTTP requests via route lookup table.
   *
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    const requestId = resolveRequestId(request);
    const pathname = new URL(request.url).pathname;
    const handler = this.routeHandlers[`${request.method} ${pathname}`];
    if (!handler) {
      return createJsonResponse({
        payload: { error: 'Unknown coordinator route' },
        status: HTTP_NOT_FOUND,
        requestId,
      });
    }
    return await handler(request, requestId);
  }

  /**
   * Returns current coordinator health and sensor staleness counts.
   *
   * @param {Request} request
   * @param {string} requestId
   * @returns {Promise<Response>}
   */
  async handleStatus(request, requestId) {
    const nowMs = Date.now();
    const [edgeMeta, edgeIndex] = await Promise.all([this.loadEdgeMeta(), this.loadEdgeIndex()]);
    const sensorRecords = await this.loadTrackedSensors(edgeIndex.sensorIndex);
    const evaluation = evaluateSensorRecords({
      sensorRecords,
      staleThresholdMs: resolveStaleThresholdMs(this.env),
      nowMs,
    });

    return createJsonResponse({
      payload: {
        status: evaluation.staleSensorCount > 0 ? STATUS_DEGRADED : STATUS_HEALTHY,
        mode: this.resolveExecutionMode(request),
        sensorCount: evaluation.sensorCount,
        staleSensorCount: evaluation.staleSensorCount,
        totalHeartbeatsIngested: edgeMeta.totalHeartbeatsIngested,
        lastHeartbeatAt: edgeMeta.lastHeartbeatAt,
        checkedAt: new Date(nowMs).toISOString(),
      },
      status: HTTP_OK,
      requestId,
    });
  }

  /**
   * Checks duplicate idempotency key or signed replay digest.
   *
   * @param {object} options
   * @param {Request} options.request
   * @param {string} options.requestId
   * @param {string} options.executionMode
   * @param {string} options.sensorId
   * @param {Record<string, number>} options.activeKeys
   * @param {number} options.totalHeartbeatsIngested
   * @returns {{ response: Response } | { idempotencyKey: string, replayKey: string }}
   */
  checkReplayAndIdempotency(options) {
    const { request, requestId, executionMode, sensorId, activeKeys, totalHeartbeatsIngested } =
      options;
    const idempotencyKey = request.headers.get(HEADER_IDEMPOTENCY_KEY)?.trim() ?? '';
    const replayKey = request.headers.get(HEADER_REPLAY_KEY)?.trim() ?? '';

    if (idempotencyKey && Object.hasOwn(activeKeys, idempotencyKey)) {
      return {
        response: createJsonResponse({
          payload: {
            accepted: true,
            deduplicated: true,
            mode: executionMode,
            idempotencyKey,
            sensorId,
            totalHeartbeatsIngested,
          },
          status: HTTP_OK,
          requestId,
        }),
      };
    }

    if (replayKey && Object.hasOwn(activeKeys, replayKey)) {
      return {
        response: createJsonResponse({
          payload: { error: 'Signed telemetry replay detected' },
          status: HTTP_UNAUTHORIZED,
          requestId,
        }),
      };
    }

    return { idempotencyKey, replayKey };
  }

  /**
   * Persists a validated, safety-checked sensor heartbeat into sharded DO storage.
   *
   * @param {Request} request
   * @param {string} requestId
   * @returns {Promise<Response>}
   */
  async handleHeartbeat(request, requestId) {
    const parsedOutcome = await parseSafeCoordinatorTelemetry({ request, requestId });
    if (!parsedOutcome.ok) {
      return parsedOutcome.response;
    }

    const executionMode = this.resolveExecutionMode(request);
    const nowMs = Date.now();
    const [edgeMeta, edgeIndex] = await Promise.all([this.loadEdgeMeta(), this.loadEdgeIndex()]);
    const activeKeys = pruneIdempotencyKeys(edgeIndex.recentIdempotencyKeys, nowMs);

    const replayOutcome = this.checkReplayAndIdempotency({
      request,
      requestId,
      executionMode,
      sensorId: parsedOutcome.telemetry.sensorId,
      activeKeys,
      totalHeartbeatsIngested: edgeMeta.totalHeartbeatsIngested,
    });
    if ('response' in replayOutcome) {
      return replayOutcome.response;
    }

    return await this.persistHeartbeatRecord({
      telemetry: parsedOutcome.telemetry,
      edgeMeta,
      edgeIndex,
      activeKeys,
      idempotencyKey: replayOutcome.idempotencyKey,
      replayKey: replayOutcome.replayKey,
      executionMode,
      nowMs,
      requestId,
    });
  }

  /**
   * Writes updated sharded sensor entry, index, and metadata to storage.
   *
   * @param {object} options
   * @returns {Promise<Response>}
   */
  async persistHeartbeatRecord(options) {
    const {
      telemetry,
      edgeMeta,
      edgeIndex,
      activeKeys,
      idempotencyKey,
      replayKey,
      executionMode,
      nowMs,
      requestId,
    } = options;

    const receivedAtIso = new Date(nowMs).toISOString();
    const orderSeq = edgeMeta.nextOrderSeq;
    const storedSensor = { ...telemetry, orderSeq, receivedAtIso };

    const nextKeys = { ...activeKeys };
    if (idempotencyKey) {
      nextKeys[idempotencyKey] = nowMs + REPLAY_WINDOW_MS;
    } else if (replayKey) {
      nextKeys[replayKey] = nowMs + REPLAY_WINDOW_MS;
    }

    const { nextIndex, evictedIds } = evictOverflowSensors({
      sensorIndex: {
        ...edgeIndex.sensorIndex,
        [telemetry.sensorId]: { receivedAtMs: nowMs, orderSeq },
      },
      activeSensorId: telemetry.sensorId,
    });

    const nextMeta = {
      ...edgeMeta,
      totalHeartbeatsIngested: edgeMeta.totalHeartbeatsIngested + 1,
      lastHeartbeatAt: receivedAtIso,
      nextOrderSeq: orderSeq + 1,
    };

    const storageDeletes =
      typeof this.state.storage.delete === 'function'
        ? evictedIds.map((evictedId) =>
            this.state.storage.delete(`${SENSOR_KEY_PREFIX}${evictedId}`)
          )
        : [];

    await Promise.all([
      this.state.storage.put(`${SENSOR_KEY_PREFIX}${telemetry.sensorId}`, storedSensor),
      this.state.storage.put(EDGE_INDEX_KEY, {
        sensorIndex: nextIndex,
        recentIdempotencyKeys: nextKeys,
      }),
      this.state.storage.put(EDGE_META_KEY, nextMeta),
      ...storageDeletes,
    ]);

    return createJsonResponse({
      payload: {
        accepted: true,
        deduplicated: false,
        mode: executionMode,
        sensor: storedSensor,
        sensorCount: Object.keys(nextIndex).length,
        totalHeartbeatsIngested: nextMeta.totalHeartbeatsIngested,
        receivedAtIso,
      },
      status: HTTP_ACCEPTED,
      requestId,
    });
  }

  /**
   * Returns all tracked sensors annotated with age and staleness status.
   *
   * @param {Request} request
   * @param {string} requestId
   * @returns {Promise<Response>}
   */
  async handleSummary(request, requestId) {
    const nowMs = Date.now();
    const [edgeMeta, edgeIndex] = await Promise.all([this.loadEdgeMeta(), this.loadEdgeIndex()]);
    const sensorRecords = await this.loadTrackedSensors(edgeIndex.sensorIndex);
    const staleThresholdMs = resolveStaleThresholdMs(this.env);
    const evaluation = evaluateSensorRecords({ sensorRecords, staleThresholdMs, nowMs });

    return createJsonResponse({
      payload: {
        mode: this.resolveExecutionMode(request),
        staleThresholdMs,
        sensorCount: evaluation.sensorCount,
        staleSensorCount: evaluation.staleSensorCount,
        totalHeartbeatsIngested: edgeMeta.totalHeartbeatsIngested,
        lastHeartbeatAt: edgeMeta.lastHeartbeatAt,
        checkedAt: new Date(nowMs).toISOString(),
        sensors: evaluation.sensors,
      },
      status: HTTP_OK,
      requestId,
    });
  }
}

const standaloneStorageMap = new Map();

/**
 * Resolves either the bound Cloudflare Durable Object stub or an honest standalone coordinator.
 *
 * @param {Record<string, unknown>} [env]
 * @returns {{ mode: 'durable-object' | 'standalone', stub: { fetch: (request: Request) => Promise<Response> } }}
 */
function resolveCoordinator(env) {
  const namespace = env?.AGENT_COORDINATOR;
  if (
    namespace &&
    typeof namespace.idFromName === 'function' &&
    typeof namespace.get === 'function'
  ) {
    const objectId = namespace.idFromName(COORDINATOR_INSTANCE_NAME);
    return {
      mode: MODE_DURABLE_OBJECT,
      stub: namespace.get(objectId),
    };
  }

  const standaloneState = {
    isStandalone: true,
    storage: {
      async get(storageKey) {
        return standaloneStorageMap.get(storageKey);
      },
      async put(storageKey, storagePayload) {
        standaloneStorageMap.set(storageKey, storagePayload);
      },
      async delete(storageKey) {
        return standaloneStorageMap.delete(storageKey);
      },
    },
  };

  return {
    mode: MODE_STANDALONE,
    stub: new AgentCoordinator(standaloneState, env),
  };
}

/**
 * Forwards an internal request to the active coordinator with mode and tracking headers.
 *
 * @param {object} options
 * @param {Record<string, unknown>} options.env
 * @param {string} options.pathname
 * @param {string} options.method
 * @param {string} options.requestId
 * @param {string} [options.bodyText]
 * @param {string} [options.idempotencyKey]
 * @param {string} [options.replayKey]
 * @returns {Promise<Response>}
 */
async function dispatchToCoordinator(options) {
  const { env, pathname, method, requestId, bodyText, idempotencyKey, replayKey } = options;
  const { mode, stub } = resolveCoordinator(env);

  const forwardHeaders = new Headers({
    [HEADER_REQUEST_ID]: requestId,
    [HEADER_COORDINATOR_MODE]: mode,
  });

  if (bodyText !== undefined) {
    forwardHeaders.set(HEADER_CONTENT_TYPE, CONTENT_TYPE_JSON);
  }
  if (idempotencyKey) {
    forwardHeaders.set(HEADER_IDEMPOTENCY_KEY, idempotencyKey);
  }
  if (replayKey) {
    forwardHeaders.set(HEADER_REPLAY_KEY, replayKey);
  }

  const internalRequest = new Request(`${INTERNAL_ORIGIN}${pathname}`, {
    method,
    headers: forwardHeaders,
    body: bodyText,
  });

  return await stub.fetch(internalRequest);
}

/**
 * Validates optional Content-Length and X-Idempotency-Key headers before reading request body.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {string} options.requestId
 * @returns {{ ok: true, idempotencyKey: string } | { ok: false, response: Response }}
 */
function validateIngestHeaders(options) {
  const { request, requestId } = options;
  const contentLengthHeader = request.headers.get(HEADER_CONTENT_LENGTH);
  if (contentLengthHeader !== null) {
    const trimmedLength = contentLengthHeader.trim();
    if (!DIGITS_ONLY_PATTERN.test(trimmedLength)) {
      return {
        ok: false,
        response: createJsonResponse({
          payload: { error: 'Invalid Content-Length header' },
          status: HTTP_BAD_REQUEST,
          requestId,
        }),
      };
    }
    const declaredBytes = Number.parseInt(trimmedLength, 10);
    if (declaredBytes > MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        response: createJsonResponse({
          payload: { error: 'Payload too large', maxSize: MAX_UPLOAD_BYTES },
          status: HTTP_PAYLOAD_TOO_LARGE,
          requestId,
        }),
      };
    }
  }

  const rawIdempotencyKey = request.headers.get(HEADER_IDEMPOTENCY_KEY);
  const idempotencyKey = rawIdempotencyKey === null ? '' : rawIdempotencyKey.trim();
  if (rawIdempotencyKey !== null && !isValidIdentifier(idempotencyKey)) {
    return {
      ok: false,
      response: createJsonResponse({
        payload: {
          error: `Header "${HEADER_IDEMPOTENCY_KEY}" must be a safe 1-${MAX_IDENTIFIER_LENGTH} char [A-Za-z0-9._:-]+ identifier`,
        },
        status: HTTP_BAD_REQUEST,
        requestId,
      }),
    };
  }

  return { ok: true, idempotencyKey };
}

/**
 * Stream-reads request body up to MAX_UPLOAD_BYTES without unbounded RAM buffering.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {string} options.requestId
 * @returns {Promise<{ ok: true, rawBody: string } | { ok: false, response: Response }>}
 */
async function readBoundedBodyText(options) {
  const { request, requestId } = options;
  const reader = request.body?.getReader?.();
  if (!reader) {
    const fallbackText = await request.text();
    if (TEXT_ENCODER.encode(fallbackText).byteLength > MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        response: createJsonResponse({
          payload: { error: 'Payload too large', maxSize: MAX_UPLOAD_BYTES },
          status: HTTP_PAYLOAD_TOO_LARGE,
          requestId,
        }),
      };
    }
    return { ok: true, rawBody: fallbackText };
  }

  const chunks = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += chunk.byteLength;
    if (totalBytes > MAX_UPLOAD_BYTES) {
      await reader.cancel().catch(() => {});
      return {
        ok: false,
        response: createJsonResponse({
          payload: { error: 'Payload too large', maxSize: MAX_UPLOAD_BYTES },
          status: HTTP_PAYLOAD_TOO_LARGE,
          requestId,
        }),
      };
    }
    chunks.push(chunk);
  }

  const mergedBytes = new Uint8Array(totalBytes);
  let byteOffset = 0;
  for (const chunk of chunks) {
    mergedBytes.set(chunk, byteOffset);
    byteOffset += chunk.byteLength;
  }
  return { ok: true, rawBody: TEXT_DECODER.decode(mergedBytes) };
}

/**
 * Enforces header validation, auth availability, bounded streaming, and HMAC verification.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {Record<string, unknown>} options.env
 * @param {string} options.requestId
 * @returns {Promise<{ ok: true, rawBody: string, idempotencyKey: string, replayKey: string } | { ok: false, response: Response }>}
 */
async function readAndAuthenticateIngestBody(options) {
  const { request, env, requestId } = options;
  const headerOutcome = validateIngestHeaders({ request, requestId });
  if (!headerOutcome.ok) {
    return headerOutcome;
  }

  const secret = typeof env?.SCADA_INGEST_SECRET === 'string' ? env.SCADA_INGEST_SECRET.trim() : '';
  const isAuthRequired = env?.REQUIRE_SCADA_AUTH === 'true' || secret.length > 0;
  if (env?.REQUIRE_SCADA_AUTH === 'true' && secret.length === 0) {
    return {
      ok: false,
      response: createJsonResponse({
        payload: { error: 'SCADA ingest authentication is required but secret is not configured' },
        status: HTTP_SERVICE_UNAVAILABLE,
        requestId,
      }),
    };
  }

  const bodyOutcome = await readBoundedBodyText({ request, requestId });
  if (!bodyOutcome.ok) {
    return bodyOutcome;
  }

  if (!isAuthRequired) {
    return {
      ok: true,
      rawBody: bodyOutcome.rawBody,
      idempotencyKey: headerOutcome.idempotencyKey,
      replayKey: '',
    };
  }

  const authOutcome = await verifyIngestSignature({
    request,
    rawBody: bodyOutcome.rawBody,
    idempotencyKey: headerOutcome.idempotencyKey,
    secret,
  });
  if (!authOutcome.ok) {
    return {
      ok: false,
      response: createJsonResponse({
        payload: { error: authOutcome.error },
        status: HTTP_UNAUTHORIZED,
        requestId,
      }),
    };
  }

  return {
    ok: true,
    rawBody: bodyOutcome.rawBody,
    idempotencyKey: headerOutcome.idempotencyKey,
    replayKey: headerOutcome.idempotencyKey
      ? ''
      : `${REPLAY_DIGEST_PREFIX}${authOutcome.replayDigest}`,
  };
}

/**
 * Parses raw JSON text and enforces the read-only industrial safety and telemetry schemas.
 *
 * @param {object} options
 * @param {string} options.rawBody
 * @param {string} options.requestId
 * @returns {{ ok: true, coordinatorBody: Record<string, unknown> } | { ok: false, response: Response }}
 */
function parseAndValidateIngestJson(options) {
  const { rawBody, requestId } = options;
  let parsedPayload;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return {
      ok: false,
      response: createJsonResponse({
        payload: { error: 'Invalid JSON payload' },
        status: HTTP_BAD_REQUEST,
        requestId,
      }),
    };
  }

  const safetyOutcome = inspectPayloadSafety(parsedPayload);
  if (!safetyOutcome.safe) {
    const status = safetyOutcome.reason === 'control_write' ? HTTP_FORBIDDEN : HTTP_BAD_REQUEST;
    const error =
      safetyOutcome.reason === 'control_write'
        ? 'Industrial safety boundary: control writes are prohibited on edge telemetry workers'
        : `Telemetry payload exceeds maximum nesting depth of ${MAX_INSPECT_DEPTH}`;
    return {
      ok: false,
      response: createJsonResponse({ payload: { error }, status, requestId }),
    };
  }

  const validationOutcome = validateTelemetryPayload(parsedPayload);
  if (!validationOutcome.ok) {
    return {
      ok: false,
      response: createJsonResponse({
        payload: { error: validationOutcome.error },
        status: HTTP_BAD_REQUEST,
        requestId,
      }),
    };
  }

  return {
    ok: true,
    coordinatorBody: {
      sensorId: validationOutcome.telemetry.sensorId,
      siteId: validationOutcome.telemetry.siteId,
      timestamp: validationOutcome.telemetry.recordedAtIso,
      metrics: validationOutcome.telemetry.metrics,
    },
  };
}

/**
 * Handles telemetry ingest for POST /telemetry/heartbeat and POST /upload.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {Record<string, unknown>} options.env
 * @param {string} options.requestId
 * @returns {Promise<Response>}
 */
async function handleTelemetryIngest(options) {
  const { request, env, requestId } = options;
  const authOutcome = await readAndAuthenticateIngestBody({ request, env, requestId });
  if (!authOutcome.ok) {
    return authOutcome.response;
  }

  const jsonOutcome = parseAndValidateIngestJson({
    rawBody: authOutcome.rawBody,
    requestId,
  });
  if (!jsonOutcome.ok) {
    return jsonOutcome.response;
  }

  return await dispatchToCoordinator({
    env,
    pathname: ROUTE_HEARTBEAT,
    method: 'POST',
    requestId,
    bodyText: JSON.stringify(jsonOutcome.coordinatorBody),
    idempotencyKey: authOutcome.idempotencyKey,
    replayKey: authOutcome.replayKey,
  });
}

/**
 * Handles safe geolocation inspection without raw string interpolation.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {string} options.requestId
 * @returns {Response}
 */
function handleGeoRequest(options) {
  const { request, requestId } = options;
  const cfMetadata = isPlainObject(request.cf) ? request.cf : {};
  const headerCountry = request.headers.get(HEADER_CF_IPCOUNTRY)?.trim();
  const country =
    (typeof cfMetadata.country === 'string' && cfMetadata.country) ||
    headerCountry ||
    UNKNOWN_GEO_COUNTRY;
  const colo = typeof cfMetadata.colo === 'string' ? cfMetadata.colo : null;
  const region = typeof cfMetadata.region === 'string' ? cfMetadata.region : null;

  return createJsonResponse({
    payload: { country, colo, region },
    status: HTTP_OK,
    requestId,
  });
}

/**
 * Handles inbound messages on a read-only SCADA WebSocket connection.
 *
 * @param {object} options
 * @param {{ send: (payload: string) => void, close: (code?: number, reason?: string) => void }} options.serverSocket
 * @param {unknown} options.rawMessage
 * @param {string} options.requestId
 */
function handleWebSocketMessage(options) {
  const { serverSocket, rawMessage, requestId } = options;
  let parsedMessage = null;
  if (typeof rawMessage === 'string') {
    try {
      parsedMessage = JSON.parse(rawMessage);
    } catch {
      parsedMessage = null;
    }
  }

  const safetyOutcome = inspectPayloadSafety(parsedMessage);
  if (!safetyOutcome.safe) {
    serverSocket.send(
      JSON.stringify({
        type: 'scada.error',
        code: 'READ_ONLY_BOUNDARY',
        error: 'Industrial safety boundary: control writes are prohibited over WebSocket',
        requestId,
      })
    );
    serverSocket.close(WEBSOCKET_CLOSE_POLICY_VIOLATION, 'Read-only boundary');
    return;
  }

  if (isPlainObject(parsedMessage) && parsedMessage.type === 'ping') {
    serverSocket.send(
      JSON.stringify({
        type: 'scada.pong',
        readOnly: true,
        requestId,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  serverSocket.send(
    JSON.stringify({
      type: 'scada.error',
      code: 'READ_ONLY_STREAM',
      error: 'WebSocket telemetry channel only supports read-only ping heartbeats',
      requestId,
    })
  );
}

/**
 * Handles WebSocket upgrade requests honestly based on runtime WebSocketPair support.
 *
 * @param {object} options
 * @param {Request} options.request
 * @param {string} options.requestId
 * @returns {Response}
 */
function handleWebSocketUpgrade(options) {
  const { request, requestId } = options;
  const upgradeHeader = request.headers.get(HEADER_UPGRADE)?.trim().toLowerCase();

  if (upgradeHeader !== WEBSOCKET_PROTOCOL_HEADER) {
    return createJsonResponse({
      payload: { error: 'Upgrade Required', expected: WEBSOCKET_PROTOCOL_HEADER },
      status: HTTP_UPGRADE_REQUIRED,
      requestId,
      extraHeaders: { [HEADER_UPGRADE]: WEBSOCKET_PROTOCOL_HEADER },
    });
  }

  const WebSocketPairCtor = globalThis.WebSocketPair;
  if (typeof WebSocketPairCtor !== 'function') {
    return createJsonResponse({
      payload: { error: 'WebSocketPair runtime unavailable outside Cloudflare Workers' },
      status: HTTP_NOT_IMPLEMENTED,
      requestId,
    });
  }

  const pair = new WebSocketPairCtor();
  const clientSocket = pair[0];
  const serverSocket = pair[1];
  serverSocket.accept();
  serverSocket.addEventListener?.('message', (event) => {
    handleWebSocketMessage({ serverSocket, rawMessage: event?.data, requestId });
  });
  serverSocket.addEventListener?.('error', () => {
    serverSocket.close?.();
  });
  serverSocket.send(
    JSON.stringify({
      type: 'scada.ack',
      readOnly: true,
      requestId,
      connectedAt: new Date().toISOString(),
    })
  );

  return new Response(null, {
    status: HTTP_SWITCHING_PROTOCOLS,
    webSocket: clientSocket,
    headers: buildBaseSecurityHeaders(requestId),
  });
}

const PUBLIC_ROUTE_HANDLERS = {
  [ROUTE_ROOT]: ({ requestId }) =>
    createJsonResponse({
      payload: {
        service: SERVICE_NAME,
        role: SERVICE_ROLE,
        readOnly: true,
        routes: PUBLIC_ROUTES,
      },
      status: HTTP_OK,
      requestId,
    }),
  [ROUTE_HEALTH]: ({ requestId }) =>
    createJsonResponse({
      payload: {
        status: 'ok',
        service: SERVICE_NAME,
        checkedAt: new Date().toISOString(),
      },
      status: HTTP_OK,
      requestId,
    }),
  [ROUTE_STATUS]: ({ env, pathname, requestId }) =>
    dispatchToCoordinator({ env, pathname, method: 'GET', requestId }),
  [ROUTE_SUMMARY]: ({ env, pathname, requestId }) =>
    dispatchToCoordinator({ env, pathname, method: 'GET', requestId }),
  [ROUTE_HEARTBEAT]: ({ request, env, requestId }) =>
    handleTelemetryIngest({ request, env, requestId }),
  [ROUTE_UPLOAD]: ({ request, env, requestId }) =>
    handleTelemetryIngest({ request, env, requestId }),
  [ROUTE_GEO]: ({ request, requestId }) => handleGeoRequest({ request, requestId }),
  [ROUTE_WS]: ({ request, requestId }) => handleWebSocketUpgrade({ request, requestId }),
};

/**
 * Primary request router for the Arch-System SCADA Edge Worker.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} [env]
 * @returns {Promise<Response>}
 */
export async function handleScadaWorkerRequest(request, env = {}) {
  const requestId = resolveRequestId(request);

  try {
    const pathname = new URL(request.url).pathname;
    const allowedMethods = ROUTE_METHODS[pathname];

    if (!allowedMethods) {
      return createJsonResponse({
        payload: { error: 'Route not found', path: pathname },
        status: HTTP_NOT_FOUND,
        requestId,
      });
    }

    if (!allowedMethods.has(request.method)) {
      return createJsonResponse({
        payload: { error: 'Method not allowed', method: request.method },
        status: HTTP_METHOD_NOT_ALLOWED,
        requestId,
      });
    }

    const routeHandler = PUBLIC_ROUTE_HANDLERS[pathname];
    return await routeHandler({ request, env, pathname, requestId });
  } catch (unexpectedError) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: SERVICE_NAME,
        requestId,
        message:
          unexpectedError instanceof Error ? unexpectedError.message : 'Unexpected worker error',
      })
    );
    return createJsonResponse({
      payload: { error: 'Internal worker error', requestId },
      status: HTTP_INTERNAL_SERVER_ERROR,
      requestId,
    });
  }
}

export default {
  /**
   * Cloudflare Workers ES Module entrypoint.
   *
   * @param {Request} request
   * @param {Record<string, unknown>} [env]
   * @param {unknown} [_ctx]
   * @returns {Promise<Response>}
   */
  async fetch(request, env, _ctx) {
    return await handleScadaWorkerRequest(request, env);
  },
};
