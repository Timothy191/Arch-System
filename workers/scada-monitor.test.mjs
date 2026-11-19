import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import workerModule, { AgentCoordinator, handleScadaWorkerRequest } from './scada-monitor.js';

const BASE_ORIGIN = 'https://scada-edge.arch-system.workers.dev';
const SHARED_TEST_SECRET = 'arch-scada-test-hmac-secret-2026';
const MAX_UPLOAD_BYTES = 1 * 1024 * 1024;
const OVERSIZED_CONTENT_LENGTH = String(MAX_UPLOAD_BYTES + 1);
const HEX_RADIX = 16;
const HEX_PAD_WIDTH = 2;
const SHA256_HEX_LENGTH = 64;
const MS_PER_SECOND = 1_000;
const REPLAY_EXPIRED_OFFSET_MS = 600_000;
const STALE_OFFSET_MS = 120_000;
const EXPECTED_STALE_THRESHOLD_MS = 30_000;
const STALE_THRESHOLD_MS_STRING = String(EXPECTED_STALE_THRESHOLD_MS);
const UTF8_FOUR_BYTE_CHAR = '🚀';
const OVERSIZED_UTF8_CHAR_COUNT = 280_000;
const WEBSOCKET_CLOSE_POLICY_VIOLATION = 1008;

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

const TEXT_ENCODER = new TextEncoder();

/**
 * Creates an in-memory mock of a Cloudflare DurableObjectNamespace backed by AgentCoordinator.
 *
 * @param {Record<string, unknown>} [env]
 * @returns {{ namespace: { idFromName: (name: string) => string, get: (id: string) => AgentCoordinator }, storageMap: Map<string, unknown> }}
 */
function createMockDurableObjectNamespace(env = {}) {
  const storageMap = new Map();
  const coordinatorCache = new Map();

  const namespace = {
    idFromName(instanceName) {
      return `do:${instanceName}`;
    },
    get(instanceId) {
      const existing = coordinatorCache.get(instanceId);
      if (existing) {
        return existing;
      }
      const mockState = {
        storage: {
          async get(storageKey) {
            return storageMap.get(storageKey);
          },
          async put(storageKey, storagePayload) {
            storageMap.set(storageKey, storagePayload);
          },
          async delete(storageKey) {
            return storageMap.delete(storageKey);
          },
        },
      };
      const coordinator = new AgentCoordinator(mockState, env);
      coordinatorCache.set(instanceId, coordinator);
      return coordinator;
    },
  };

  return { namespace, storageMap };
}

/**
 * Computes an HMAC-SHA256 signature header matching worker canonical verification.
 *
 * @param {object} options
 * @param {string} options.secret
 * @param {string} options.timestampHeader
 * @param {string} [options.idempotencyKey]
 * @param {string} options.rawBody
 * @returns {Promise<string>}
 */
async function signTelemetryPayload(options) {
  const { secret, timestampHeader, idempotencyKey = '', rawBody } = options;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const canonicalMessage = `${timestampHeader}.${idempotencyKey}.${rawBody}`;
  const digestBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    TEXT_ENCODER.encode(canonicalMessage)
  );
  const hexDigest = Array.from(new Uint8Array(digestBuffer))
    .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_PAD_WIDTH, '0'))
    .join('');
  return `sha256=${hexDigest}`;
}

/**
 * Asserts that standard security headers are present on every response.
 *
 * @param {Response} response
 * @param {string} [expectedRequestId]
 */
function assertSecurityHeaders(response, expectedRequestId) {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const requestId = response.headers.get('x-request-id');
  assert.equal(typeof requestId, 'string');
  assert.equal((requestId ?? '').length > 0, true);
  if (expectedRequestId) {
    assert.equal(requestId, expectedRequestId);
  }
}

/**
 * Builds a minimal WebSocketPair mock class for Workers runtime testing.
 */
function createMockWebSocketPairClass() {
  return class MockWebSocketPair {
    constructor() {
      const sentFrames = [];
      let closeInfo = null;
      const listeners = new Map();
      const clientSocket = {
        sentFrames,
        get closeInfo() {
          return closeInfo;
        },
        emitMessage(payload) {
          for (const listener of listeners.get('message') ?? []) {
            listener({ data: payload });
          }
        },
      };
      const serverSocket = {
        accept() {},
        send(frameText) {
          sentFrames.push(frameText);
        },
        close(code, reason) {
          closeInfo = { code, reason };
        },
        addEventListener(eventName, handler) {
          const existing = listeners.get(eventName) ?? [];
          existing.push(handler);
          listeners.set(eventName, existing);
        },
      };
      this[0] = clientSocket;
      this[1] = serverSocket;
    }
  };
}

describe('workers/scada-monitor.js ES module worker', () => {
  it('returns read-only service manifest and mandatory security headers on GET /', async () => {
    const inboundRequestId = 'req-manifest-001';
    const response = await workerModule.fetch(
      new Request(`${BASE_ORIGIN}/`, {
        method: 'GET',
        headers: { 'x-request-id': inboundRequestId },
      }),
      {}
    );

    assert.equal(response.status, HTTP_OK);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assertSecurityHeaders(response, inboundRequestId);

    const manifestPayload = await response.json();
    assert.equal(manifestPayload.service, 'arch-system-scada-monitor');
    assert.equal(manifestPayload.readOnly, true);
    assert.equal(Array.isArray(manifestPayload.routes), true);
    assert.equal(manifestPayload.routes.includes('/telemetry/heartbeat'), true);
    assert.equal(manifestPayload.routes.includes('/telemetry/summary'), true);
    assert.equal(manifestPayload.routes.includes('/health'), true);
  });

  it('serves GET /health and distinguishes durable-object vs standalone mode on GET /status', async () => {
    const healthResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/health`, { method: 'GET' }),
      {}
    );
    assert.equal(healthResponse.status, HTTP_OK);
    assertSecurityHeaders(healthResponse);
    const healthBody = await healthResponse.json();
    assert.equal(healthBody.status, 'ok');
    assert.equal(healthBody.service, 'arch-system-scada-monitor');
    assert.equal(typeof healthBody.checkedAt, 'string');

    const standaloneStatusResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/status`, { method: 'GET' }),
      {}
    );
    assert.equal(standaloneStatusResponse.status, HTTP_OK);
    assertSecurityHeaders(standaloneStatusResponse);
    const standaloneStatus = await standaloneStatusResponse.json();
    assert.equal(standaloneStatus.mode, 'standalone');
    assert.equal(standaloneStatus.status, 'healthy');

    const { namespace } = createMockDurableObjectNamespace();
    const durableStatusResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/status`, { method: 'GET' }),
      { AGENT_COORDINATOR: namespace }
    );
    assert.equal(durableStatusResponse.status, HTTP_OK);
    assertSecurityHeaders(durableStatusResponse);
    const durableStatus = await durableStatusResponse.json();
    assert.equal(durableStatus.mode, 'durable-object');
    assert.equal(durableStatus.status, 'healthy');
    assert.equal(durableStatus.sensorCount, 0);
    assert.equal(durableStatus.staleSensorCount, 0);
    assert.equal(durableStatus.totalHeartbeatsIngested, 0);
  });

  it('persists sharded heartbeats in Durable Object storage, supports /upload alias, and detects stale sensors', async () => {
    const envConfig = { SCADA_STALE_THRESHOLD_MS: STALE_THRESHOLD_MS_STRING };
    const { namespace, storageMap } = createMockDurableObjectNamespace(envConfig);
    const workerEnv = { ...envConfig, AGENT_COORDINATOR: namespace };

    const freshTimestamp = new Date().toISOString();
    const freshResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sensorId: 'CRUSHER-01',
          siteId: 'pit-north',
          timestamp: freshTimestamp,
          metrics: { powerKw: 420.5, running: true },
        }),
      }),
      workerEnv
    );

    assert.equal(freshResponse.status, HTTP_ACCEPTED);
    assertSecurityHeaders(freshResponse);
    const freshResult = await freshResponse.json();
    assert.equal(freshResult.accepted, true);
    assert.equal(freshResult.deduplicated, false);
    assert.equal(freshResult.mode, 'durable-object');
    assert.equal(freshResult.sensorCount, 1);
    assert.equal(storageMap.has('scada:edge:meta'), true);
    assert.equal(storageMap.has('scada:edge:index'), true);
    assert.equal(storageMap.has('sensor:CRUSHER-01'), true);

    const staleTimestamp = new Date(Date.now() - STALE_OFFSET_MS).toISOString();
    const uploadAliasResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/upload`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sensorId: 'CONVEYOR-02',
          timestamp: staleTimestamp,
          beltSpeedMps: 3.4,
        }),
      }),
      workerEnv
    );

    assert.equal(uploadAliasResponse.status, HTTP_ACCEPTED);
    const uploadAliasResult = await uploadAliasResponse.json();
    assert.equal(uploadAliasResult.sensorCount, 2);
    assert.equal(uploadAliasResult.totalHeartbeatsIngested, 2);
    assert.equal(storageMap.has('sensor:CONVEYOR-02'), true);

    const summaryResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/summary`, { method: 'GET' }),
      workerEnv
    );
    assert.equal(summaryResponse.status, HTTP_OK);
    assertSecurityHeaders(summaryResponse);
    const summaryPayload = await summaryResponse.json();
    assert.equal(summaryPayload.mode, 'durable-object');
    assert.equal(summaryPayload.staleThresholdMs, EXPECTED_STALE_THRESHOLD_MS);
    assert.equal(summaryPayload.sensorCount, 2);
    assert.equal(summaryPayload.staleSensorCount, 1);

    const statusResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/status`, { method: 'GET' }),
      workerEnv
    );
    const statusPayload = await statusResponse.json();
    assert.equal(statusPayload.status, 'degraded');
    assert.equal(statusPayload.staleSensorCount, 1);
    assert.equal(statusPayload.totalHeartbeatsIngested, 2);
  });

  it('enforces fail-closed HMAC auth, signed X-Idempotency-Key deduplication, and anti-replay protection', async () => {
    const { namespace } = createMockDurableObjectNamespace();
    const whitespaceSecretEnv = {
      AGENT_COORDINATOR: namespace,
      REQUIRE_SCADA_AUTH: 'true',
      SCADA_INGEST_SECRET: '   ',
    };

    const failClosedResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({ sensorId: 'PUMP-01', metrics: { pressureBar: 5.1 } }),
      }),
      whitespaceSecretEnv
    );
    assert.equal(failClosedResponse.status, HTTP_SERVICE_UNAVAILABLE);
    assertSecurityHeaders(failClosedResponse);

    const authEnv = {
      AGENT_COORDINATOR: namespace,
      REQUIRE_SCADA_AUTH: 'true',
      SCADA_INGEST_SECRET: SHARED_TEST_SECRET,
    };
    const payloadBody = JSON.stringify({
      sensorId: 'PUMP-01',
      metrics: { pressureBar: 6.4 },
    });

    const missingSignatureResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        body: payloadBody,
      }),
      authEnv
    );
    assert.equal(missingSignatureResponse.status, HTTP_UNAUTHORIZED);

    const currentEpochSec = String(Math.floor(Date.now() / MS_PER_SECOND));
    const badSigResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: {
          'x-arch-timestamp': currentEpochSec,
          'x-arch-signature-256': `sha256=${'0'.repeat(SHA256_HEX_LENGTH)}`,
        },
        body: payloadBody,
      }),
      authEnv
    );
    assert.equal(badSigResponse.status, HTTP_UNAUTHORIZED);

    const expiredTimestamp = String(Date.now() - REPLAY_EXPIRED_OFFSET_MS);
    const expiredSignature = await signTelemetryPayload({
      secret: SHARED_TEST_SECRET,
      timestampHeader: expiredTimestamp,
      rawBody: payloadBody,
    });
    const expiredResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: {
          'x-arch-timestamp': expiredTimestamp,
          'x-arch-signature-256': expiredSignature,
        },
        body: payloadBody,
      }),
      authEnv
    );
    assert.equal(expiredResponse.status, HTTP_UNAUTHORIZED);

    const idempotencyKey = 'hb-pump-01-seq-99';
    const validSignature = await signTelemetryPayload({
      secret: SHARED_TEST_SECRET,
      timestampHeader: currentEpochSec,
      idempotencyKey,
      rawBody: payloadBody,
    });

    const tamperedKeyResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-arch-timestamp': currentEpochSec,
          'x-arch-signature-256': validSignature,
          'x-idempotency-key': 'tampered-key',
        },
        body: payloadBody,
      }),
      authEnv
    );
    assert.equal(tamperedKeyResponse.status, HTTP_UNAUTHORIZED);

    const firstAccepted = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-arch-timestamp': currentEpochSec,
          'x-arch-signature-256': validSignature,
          'x-idempotency-key': idempotencyKey,
        },
        body: payloadBody,
      }),
      authEnv
    );
    assert.equal(firstAccepted.status, HTTP_ACCEPTED);
    const firstJson = await firstAccepted.json();
    assert.equal(firstJson.deduplicated, false);
    assert.equal(firstJson.totalHeartbeatsIngested, 1);

    const duplicateResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-arch-timestamp': currentEpochSec,
          'x-arch-signature-256': validSignature,
          'x-idempotency-key': idempotencyKey,
        },
        body: payloadBody,
      }),
      authEnv
    );
    assert.equal(duplicateResponse.status, HTTP_OK);
    const duplicateJson = await duplicateResponse.json();
    assert.equal(duplicateJson.deduplicated, true);
    assert.equal(duplicateJson.totalHeartbeatsIngested, 1);

    const noKeySig = await signTelemetryPayload({
      secret: SHARED_TEST_SECRET,
      timestampHeader: currentEpochSec,
      rawBody: payloadBody,
    });
    const firstNoKey = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-arch-timestamp': currentEpochSec,
          'x-arch-signature-256': noKeySig,
        },
        body: payloadBody,
      }),
      authEnv
    );
    assert.equal(firstNoKey.status, HTTP_ACCEPTED);

    const replayedNoKey = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-arch-timestamp': currentEpochSec,
          'x-arch-signature-256': noKeySig,
        },
        body: payloadBody,
      }),
      authEnv
    );
    assert.equal(replayedNoKey.status, HTTP_UNAUTHORIZED);
  });

  it('enforces normalized industrial read-only boundary across worker and direct DO calls', async () => {
    const { namespace } = createMockDurableObjectNamespace();
    const workerEnv = { AGENT_COORDINATOR: namespace };

    const controlVariants = [
      { sensorId: 'VALVE-01', plcCommand: 'OPEN_MAIN_VALVE', metrics: { flowLps: 12 } },
      { sensorId: 'VALVE-02', metrics: { flowLps: 14, write_tag: 'DB10.DW4=1' } },
      { sensorId: 'VALVE-03', metrics: { PLC_COMMAND: 'TRIP', flowLps: 15 } },
      { sensorId: 'VALVE-04', metrics: { opcuaWrite: true, flowLps: 16 } },
      { sensorId: 'VALVE-05', metrics: { 'coil-write': 1, flowLps: 17 } },
    ];

    for (const controlPayload of controlVariants) {
      const blockedResponse = await handleScadaWorkerRequest(
        new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
          method: 'POST',
          body: JSON.stringify(controlPayload),
        }),
        workerEnv
      );
      assert.equal(blockedResponse.status, HTTP_FORBIDDEN);
      assertSecurityHeaders(blockedResponse);
    }

    const coordinatorStub = namespace.get(namespace.idFromName('direct-test'));
    const directDoBlocked = await coordinatorStub.fetch(
      new Request('https://coordinator.internal/telemetry/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sensorId: 'VALVE-06',
          metrics: { coilWrite: 1 },
        }),
      })
    );
    assert.equal(directDoBlocked.status, HTTP_FORBIDDEN);
  });

  it('rejects prototype-pollution keys, invalid Content-Length, bad schemas, and >1 MiB UTF-8 streams', async () => {
    const { namespace } = createMockDurableObjectNamespace();
    const workerEnv = { AGENT_COORDINATOR: namespace };

    const protoMetricsResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        body: '{"sensorId":"S-01","metrics":{"__proto__":1,"tempC":42}}',
      }),
      workerEnv
    );
    assert.equal(protoMetricsResponse.status, HTTP_BAD_REQUEST);

    const constructorSensorResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        body: '{"sensorId":"constructor","metrics":{"tempC":42}}',
      }),
      workerEnv
    );
    assert.equal(constructorSensorResponse.status, HTTP_BAD_REQUEST);

    const extraTopLevelResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({
          sensorId: 'S-02',
          unexpectedKey: 'ignored-no-more',
          metrics: { tempC: 42 },
        }),
      }),
      workerEnv
    );
    assert.equal(extraTopLevelResponse.status, HTTP_BAD_REQUEST);

    const badLengthResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/upload`, {
        method: 'POST',
        headers: { 'content-length': '-12abc' },
        body: '{}',
      }),
      workerEnv
    );
    assert.equal(badLengthResponse.status, HTTP_BAD_REQUEST);

    const badIdempotencyHeader = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        headers: { 'x-idempotency-key': '__proto__' },
        body: JSON.stringify({ sensorId: 'S-03', metrics: { tempC: 42 } }),
      }),
      workerEnv
    );
    assert.equal(badIdempotencyHeader.status, HTTP_BAD_REQUEST);

    const malformedJsonResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/upload`, {
        method: 'POST',
        body: '{malformed-json',
      }),
      workerEnv
    );
    assert.equal(malformedJsonResponse.status, HTTP_BAD_REQUEST);

    const oversizedHeaderResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/upload`, {
        method: 'POST',
        headers: { 'content-length': OVERSIZED_CONTENT_LENGTH },
        body: '{}',
      }),
      workerEnv
    );
    assert.equal(oversizedHeaderResponse.status, HTTP_PAYLOAD_TOO_LARGE);
    const oversizedHeaderJson = await oversizedHeaderResponse.json();
    assert.equal(oversizedHeaderJson.maxSize, MAX_UPLOAD_BYTES);

    const oversizedMultiByteBody = JSON.stringify({
      sensorId: 'UTF8-SENSOR-01',
      metrics: { note: UTF8_FOUR_BYTE_CHAR.repeat(OVERSIZED_UTF8_CHAR_COUNT) },
    });
    assert.equal(oversizedMultiByteBody.length < MAX_UPLOAD_BYTES, true);
    assert.equal(TEXT_ENCODER.encode(oversizedMultiByteBody).byteLength > MAX_UPLOAD_BYTES, true);

    const oversizedUtf8Response = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/telemetry/heartbeat`, {
        method: 'POST',
        body: oversizedMultiByteBody,
      }),
      workerEnv
    );
    assert.equal(oversizedUtf8Response.status, HTTP_PAYLOAD_TOO_LARGE);
  });

  it('prevents JSON injection on GET /geo and tests GET /ws upgrade + read-only policy enforcement', async () => {
    const injectionAttempt = 'ZA","injected\t":"evil';
    const geoResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/geo`, {
        method: 'GET',
        headers: { 'cf-ipcountry': injectionAttempt },
      }),
      {}
    );
    assert.equal(geoResponse.status, HTTP_OK);
    assertSecurityHeaders(geoResponse);
    const geoPayload = await geoResponse.json();
    assert.deepEqual(geoPayload, {
      country: injectionAttempt,
      colo: null,
      region: null,
    });

    const missingUpgradeResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/ws`, { method: 'GET' }),
      {}
    );
    assert.equal(missingUpgradeResponse.status, HTTP_UPGRADE_REQUIRED);
    assert.equal(missingUpgradeResponse.headers.get('upgrade'), 'websocket');
    assertSecurityHeaders(missingUpgradeResponse);

    const unavailableWsResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/ws`, {
        method: 'GET',
        headers: { upgrade: 'WebSocket' },
      }),
      {}
    );
    assert.equal(unavailableWsResponse.status, HTTP_NOT_IMPLEMENTED);
    assertSecurityHeaders(unavailableWsResponse);

    const previousWebSocketPair = globalThis.WebSocketPair;
    const PreviousResponse = globalThis.Response;
    globalThis.WebSocketPair = createMockWebSocketPairClass();
    globalThis.Response = class MockWorkerResponse extends PreviousResponse {
      constructor(body, init = {}) {
        if (init?.status === HTTP_SWITCHING_PROTOCOLS && init?.webSocket) {
          super(null, { status: HTTP_OK, headers: init.headers });
          this.statusOverride = HTTP_SWITCHING_PROTOCOLS;
          this.webSocket = init.webSocket;
          return;
        }
        super(body, init);
      }

      get status() {
        return this.statusOverride ?? super.status;
      }
    };
    try {
      const upgradedResponse = await handleScadaWorkerRequest(
        new Request(`${BASE_ORIGIN}/ws`, {
          method: 'GET',
          headers: { upgrade: 'websocket' },
        }),
        {}
      );
      assert.equal(upgradedResponse.status, HTTP_SWITCHING_PROTOCOLS);
      assertSecurityHeaders(upgradedResponse);

      const clientSocket = upgradedResponse.webSocket;
      assert.equal(clientSocket.sentFrames.length, 1);
      assert.equal(JSON.parse(clientSocket.sentFrames[0]).type, 'scada.ack');

      clientSocket.emitMessage(JSON.stringify({ type: 'ping' }));
      assert.equal(clientSocket.sentFrames.length, 2);
      assert.equal(JSON.parse(clientSocket.sentFrames[1]).type, 'scada.pong');

      clientSocket.emitMessage(JSON.stringify({ plc_command: 'OPEN' }));
      assert.equal(clientSocket.sentFrames.length, 3);
      assert.equal(JSON.parse(clientSocket.sentFrames[2]).code, 'READ_ONLY_BOUNDARY');
      assert.deepEqual(clientSocket.closeInfo, {
        code: WEBSOCKET_CLOSE_POLICY_VIOLATION,
        reason: 'Read-only boundary',
      });
    } finally {
      globalThis.WebSocketPair = previousWebSocketPair;
      globalThis.Response = PreviousResponse;
    }
  });

  it('returns 404/405 for invalid routes/methods and logs + returns 500 JSON error boundary on failure', async () => {
    const unknownRouteResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/old-api`, { method: 'GET' }),
      {}
    );
    assert.equal(unknownRouteResponse.status, HTTP_NOT_FOUND);
    assertSecurityHeaders(unknownRouteResponse);

    const wrongMethodResponse = await handleScadaWorkerRequest(
      new Request(`${BASE_ORIGIN}/status`, { method: 'POST' }),
      {}
    );
    assert.equal(wrongMethodResponse.status, HTTP_METHOD_NOT_ALLOWED);
    assertSecurityHeaders(wrongMethodResponse);

    const loggedErrors = [];
    const originalConsoleError = console.error;
    console.error = (logLine) => {
      loggedErrors.push(logLine);
    };

    try {
      const failingRequest = {
        get url() {
          throw new Error('Synthetic request url failure');
        },
      };
      const errorBoundaryResponse = await workerModule.fetch(failingRequest, {});
      assert.equal(errorBoundaryResponse.status, HTTP_INTERNAL_SERVER_ERROR);
      assert.equal(errorBoundaryResponse.headers.get('content-type'), 'application/json');
      assertSecurityHeaders(errorBoundaryResponse);

      const errorBody = await errorBoundaryResponse.json();
      assert.equal(errorBody.error, 'Internal worker error');
      assert.equal(typeof errorBody.requestId, 'string');
      assert.equal(loggedErrors.length, 1);

      const parsedLog = JSON.parse(loggedErrors[0]);
      assert.equal(parsedLog.level, 'error');
      assert.equal(parsedLog.requestId, errorBody.requestId);
      assert.equal(parsedLog.message, 'Synthetic request url failure');
    } finally {
      console.error = originalConsoleError;
    }
  });
});
