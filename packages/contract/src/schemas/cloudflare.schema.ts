import { z } from 'zod';

/**
 * Cloudflare Platform contracts (Zero Trust, Tunnel, Workers, Queues,
 * Turnstile, AI Gateway, R2, and account-level status).
 *
 * Every status field uses a three-state connection mode so the Control Room
 * can render "Not connected" / "Insufficient permissions" / "Metrics unavailable"
 * without ever fabricating telemetry:
 *   - `unconfigured`  — no credentials/env vars set
 *   - `insufficient`  — credentials present but token lacks required scopes
 *   - `live`          — API reachable and data is real
 *   - `fallback`      — API unreachable / error; data is unavailable
 *
 * No schema here may ever carry a secret value; only booleans such as
 * `configured` and `hasAccess` indicate presence of credentials.
 */

export const cloudflareConnectionModeSchema = z.enum([
  'live',
  'fallback',
  'unconfigured',
  'insufficient',
]);
export type CloudflareConnectionMode = z.infer<typeof cloudflareConnectionModeSchema>;

/** Aggregate account/zone connectivity summary for the Edge Overview panel. */
export const cloudflareAccountStatusSchema = z.object({
  id: z.literal('cloudflare-account'),
  label: z.literal('Cloudflare Account'),
  mode: cloudflareConnectionModeSchema,
  endpointConfigured: z.boolean(),
  latencyMs: z.number().nonnegative().nullable(),
  detail: z.string(),
  /** ISO timestamp of last successful sync, or null when never synced. */
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareAccountStatus = z.infer<typeof cloudflareAccountStatusSchema>;

/** Zero Trust access policy inventory entry (read-only). */
export const cloudflareZeroTrustPolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** `application` | `self_hosted` | `api` — Cloudflare Access application type. */
  applicationType: z.enum(['application', 'self_hosted', 'api']),
  /** Identity providers configured for the policy. */
  identityProviders: z.array(z.string().min(1)),
  /** Whether the policy is currently active. */
  isActive: z.boolean(),
  /** Session duration in minutes, when known. */
  sessionDurationMinutes: z.number().int().positive().nullable(),
  /** Last policy modification timestamp, when known. */
  updatedAt: z.string().datetime().nullable(),
});
export type CloudflareZeroTrustPolicy = z.infer<typeof cloudflareZeroTrustPolicySchema>;

/** Zero Trust section aggregate. */
export const cloudflareZeroTrustStatusSchema = z.object({
  mode: cloudflareConnectionModeSchema,
  /** `true` when CLOUDFLARE_ZERO_TRUST_TOKEN is present (never the value). */
  tokenConfigured: z.boolean(),
  /** `true` when the token has the Access read scopes; false => insufficient. */
  hasAccessReadScope: z.boolean(),
  policies: z.array(cloudflareZeroTrustPolicySchema),
  applications: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      domain: z.string().min(1),
      type: z.enum(['self_hosted', 'saas', 'application', 'api']),
    })
  ),
  serviceTokens: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      /** Token value is NEVER included; only presence + expiry. */
      clientIdPresent: z.boolean(),
      expiresAt: z.string().datetime().nullable(),
    })
  ),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareZeroTrustStatus = z.infer<typeof cloudflareZeroTrustStatusSchema>;

/** Tunnel inventory entry (read-only). */
export const cloudflareTunnelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** `active` | `inactive` | `pending` as reported by the API. */
  status: z.enum(['active', 'inactive', 'pending']),
  /** Hostname -> origin service mappings declared in the tunnel config. */
  routes: z.array(
    z.object({
      hostname: z.string().min(1),
      service: z.string().min(1),
    })
  ),
  /** Last time the tunnel was seen connected, when known. */
  lastSeenAt: z.string().datetime().nullable(),
  /** Origin health as reported by the API (unknown until live). */
  originHealthy: z.boolean().nullable(),
});
export type CloudflareTunnel = z.infer<typeof cloudflareTunnelSchema>;

export const cloudflareTunnelStatusSchema = z.object({
  mode: cloudflareConnectionModeSchema,
  tokenConfigured: z.boolean(),
  tunnels: z.array(cloudflareTunnelSchema),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareTunnelStatus = z.infer<typeof cloudflareTunnelStatusSchema>;

/** Worker inventory entry (read-only). */
export const cloudflareWorkerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Deployment tag / version when available. */
  version: z.string().min(1).nullable(),
  /** Whether the Worker has been deployed at least once. */
  hasDeployments: z.boolean(),
  /** Latest deployment status. */
  deploymentStatus: z.enum(['success', 'failure', 'unknown']).nullable(),
  /** Latest deployment timestamp. */
  lastDeployedAt: z.string().datetime().nullable(),
});
export type CloudflareWorker = z.infer<typeof cloudflareWorkerSchema>;

export const cloudflareWorkersStatusSchema = z.object({
  mode: cloudflareConnectionModeSchema,
  tokenConfigured: z.boolean(),
  workers: z.array(cloudflareWorkerSchema),
  /** Worker request/error metrics are only present when the API exposes them. */
  requestCount24h: z.number().nonnegative().nullable(),
  errorRatePercent: z.number().nonnegative().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareWorkersStatus = z.infer<typeof cloudflareWorkersStatusSchema>;

/** Queue inventory entry (read-only). */
export const cloudflareQueueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Approximate pending/backlog message count, when supported. */
  pendingMessages: z.number().int().nonnegative().nullable(),
  /** Whether a dead-letter queue is attached. */
  hasDlq: z.boolean(),
  /** Consumer connection health, when reported. */
  consumerHealthy: z.boolean().nullable(),
  /** Approximate messages in the DLQ. */
  dlqDepth: z.number().int().nonnegative().nullable(),
});
export type CloudflareQueue = z.infer<typeof cloudflareQueueSchema>;

export const cloudflareQueuesStatusSchema = z.object({
  mode: cloudflareConnectionModeSchema,
  tokenConfigured: z.boolean(),
  queues: z.array(cloudflareQueueSchema),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareQueuesStatus = z.infer<typeof cloudflareQueuesStatusSchema>;

/** Turnstile configuration status (read-only; secret never present). */
export const cloudflareTurnstileStatusSchema = z.object({
  mode: cloudflareConnectionModeSchema,
  /** `true` when NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is set. */
  siteKeyConfigured: z.boolean(),
  /** `true` when CLOUDFLARE_TURNSTILE_SECRET_KEY is set server-side. */
  secretKeyConfigured: z.boolean(),
  /** Sitekey verification health — null when no verification has occurred. */
  verificationHealthy: z.boolean().nullable(),
  /** Failure rate over the last 24h, when the API exposes it. */
  failureRatePercent: z.number().nonnegative().nullable(),
  /** Application flows protected by Turnstile (app-side registry, not CF data). */
  protectedFlows: z.array(z.string().min(1)),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareTurnstileStatus = z.infer<typeof cloudflareTurnstileStatusSchema>;

/** AI Gateway configuration status (read-only). */
export const cloudflareAiGatewayStatusSchema = z.object({
  mode: cloudflareConnectionModeSchema,
  tokenConfigured: z.boolean(),
  /** Whether the feature flag is enabled app-side. */
  featureEnabled: z.boolean(),
  /** Providers routed through the Gateway, when known. */
  providers: z.array(z.string().min(1)),
  /** Request volume over the last 24h, when available. */
  requestCount24h: z.number().int().nonnegative().nullable(),
  /** Average latency in ms, when available. */
  avgLatencyMs: z.number().nonnegative().nullable(),
  /** Error rate percent, when available. */
  errorRatePercent: z.number().nonnegative().nullable(),
  /** Token usage / cost reporting availability. */
  costReportingAvailable: z.boolean(),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareAiGatewayStatus = z.infer<typeof cloudflareAiGatewayStatusSchema>;

/** R2 bucket inventory entry (read-only). */
export const cloudflareR2BucketSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Whether the bucket is publicly accessible (should always be false). */
  isPublic: z.boolean(),
  /** Approximate object count, when supported. */
  objectCount: z.number().int().nonnegative().nullable(),
  /** Approximate storage usage in bytes, when supported. */
  usageBytes: z.number().int().nonnegative().nullable(),
  /** Whether lifecycle rules are configured. */
  hasLifecycleRules: z.boolean(),
  /** Whether versioning is enabled. */
  versioningEnabled: z.boolean().nullable(),
});
export type CloudflareR2Bucket = z.infer<typeof cloudflareR2BucketSchema>;

export const cloudflareR2StatusSchema = z.object({
  mode: cloudflareConnectionModeSchema,
  tokenConfigured: z.boolean(),
  buckets: z.array(cloudflareR2BucketSchema),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareR2Status = z.infer<typeof cloudflareR2StatusSchema>;

/** Security Centre aggregate (read-only; no fabricated metrics). */
export const cloudflareSecurityCentreStatusSchema = z.object({
  mode: cloudflareConnectionModeSchema,
  tokenConfigured: z.boolean(),
  /** WAF / rate-limit rule counts, when the API exposes them. */
  wafRules: z.number().int().nonnegative().nullable(),
  rateLimitRules: z.number().int().nonnegative().nullable(),
  /** Access policy count from Zero Trust. */
  accessPolicies: z.number().int().nonnegative().nullable(),
  /** Configuration warnings surfaced during the sync. */
  warnings: z.array(z.string().min(1)),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type CloudflareSecurityCentreStatus = z.infer<typeof cloudflareSecurityCentreStatusSchema>;

/**
 * Aggregate response for the Cloudflare Infrastructure & Edge Security Centre.
 * Every section carries its own mode so the UI can render per-service state.
 */
export const cloudflareSummaryResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  deploymentTarget: z.enum(['vercel', 'local']),
  account: cloudflareAccountStatusSchema,
  zeroTrust: cloudflareZeroTrustStatusSchema,
  tunnel: cloudflareTunnelStatusSchema,
  workers: cloudflareWorkersStatusSchema,
  queues: cloudflareQueuesStatusSchema,
  turnstile: cloudflareTurnstileStatusSchema,
  aiGateway: cloudflareAiGatewayStatusSchema,
  r2: cloudflareR2StatusSchema,
  securityCentre: cloudflareSecurityCentreStatusSchema,
});
export type CloudflareSummaryResponse = z.infer<typeof cloudflareSummaryResponseSchema>;

/**
 * Server-side Turnstile verification result (never includes the secret).
 */
export const turnstileVerificationResultSchema = z.object({
  success: z.boolean(),
  /** `true` when verification completed; `false` when Cloudflare was unreachable. */
  verified: z.boolean(),
  /** Error code returned by the Turnstile API, when any. */
  errorCode: z.string().min(1).nullable(),
  /** Human-readable detail (safe for logs; never contains the secret). */
  detail: z.string(),
});
export type TurnstileVerificationResult = z.infer<typeof turnstileVerificationResultSchema>;

/** Input for server-side Turnstile token verification. */
export const turnstileVerifyInputSchema = z.object({
  token: z.string().min(1),
  /** Optional remote IP for risk evaluation. */
  remoteIp: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'Must be a valid IPv4 address')
    .optional(),
});
export type TurnstileVerifyInput = z.infer<typeof turnstileVerifyInputSchema>;

/** Feature-flag registry for Cloudflare opt-in services. */
export const cloudflareFeatureFlagsSchema = z.object({
  turnstile: z.boolean().default(false),
  aiGateway: z.boolean().default(false),
  workers: z.boolean().default(false),
  queues: z.boolean().default(false),
  r2: z.boolean().default(false),
  zeroTrust: z.boolean().default(false),
  tunnel: z.boolean().default(false),
});
export type CloudflareFeatureFlags = z.infer<typeof cloudflareFeatureFlagsSchema>;

/**
 * Guard: rejects event types that would initiate plant-control commands.
 * Mirrors the queue-side PROHIBITED_EVENT_TYPES list.
 */
export const PROHIBITED_CLOUDFLARE_EVENT_TYPES = [
  'plant.control.start',
  'plant.control.stop',
  'plc.write',
  'modbus.write',
  'opcua.control',
  'machinery.start',
  'machinery.stop',
  'interlock.bypass',
  'safety.system.modify',
] as const;

export const prohibitedCloudflareEventTypeSchema = z.enum(PROHIBITED_CLOUDFLARE_EVENT_TYPES);
export type ProhibitedCloudflareEventType = z.infer<typeof prohibitedCloudflareEventTypeSchema>;

/** Validate that an event type is NOT a prohibited plant-control command. */
export function assertNotPlantControlEventType(eventType: string): void {
  if ((PROHIBITED_CLOUDFLARE_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new Error(
      `Cloudflare event type "${eventType}" is prohibited: plant-control commands must never be issued from the edge`
    );
  }
}
