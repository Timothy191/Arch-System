import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.schema';

// ---------------------------------------------------------------------------
// Remote Support Enumerations
// ---------------------------------------------------------------------------

export const remoteSupportTierSchema = z.enum(['tier1_browser', 'tier2_os_desktop']);
export type RemoteSupportTier = z.infer<typeof remoteSupportTierSchema>;

export const remoteSupportSessionStatusSchema = z.enum([
  'pending',
  'claimed',
  'consent_requested',
  'active',
  'ended',
  'rejected',
  'expired',
  'revoked',
]);
export type RemoteSupportSessionStatus = z.infer<typeof remoteSupportSessionStatusSchema>;

export const remoteSupportDeviceClassSchema = z.enum([
  'workstation',
  'laptop',
  'scada_hmi',
  'unattended_kiosk',
  'server',
]);
export type RemoteSupportDeviceClass = z.infer<typeof remoteSupportDeviceClassSchema>;

export const remoteSupportProtocolSchema = z.enum(['rdp', 'vnc', 'ssh', 'meshcentral']);
export type RemoteSupportProtocol = z.infer<typeof remoteSupportProtocolSchema>;

export const remoteSupportAuditEventTypeSchema = z.enum([
  'session_created',
  'session_claimed',
  'consent_requested',
  'consent_granted',
  'consent_rejected',
  'webrtc_connected',
  'cobrowse_requested',
  'cobrowse_granted',
  'cobrowse_revoked',
  'tier2_token_issued',
  'tier2_connected',
  'diagnostics_captured',
  'session_ended',
  'session_revoked',
  'session_expired',
]);
export type RemoteSupportAuditEventType = z.infer<typeof remoteSupportAuditEventTypeSchema>;

export const remoteSupportCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Support code must be 6 digits');

// ---------------------------------------------------------------------------
// Sanitized Diagnostics Schema
// ---------------------------------------------------------------------------

export const clientDiagnosticsSchema = z.object({
  route: z.string().max(300).optional(),
  portalVersion: z.string().max(40).optional(),
  viewportWidth: z.number().int().min(0).max(16384).optional(),
  viewportHeight: z.number().int().min(0).max(16384).optional(),
  isOnline: z.boolean().optional(),
  offlineQueueCount: z.number().int().min(0).max(10000).optional(),
  userAgentSummary: z.string().max(240).optional(),
  capturedAt: z.string().max(64).optional(),
  recentErrors: z.array(z.string().max(400)).max(15).optional(),
});
export type ClientDiagnostics = z.infer<typeof clientDiagnosticsSchema>;

// ---------------------------------------------------------------------------
// Session Lifecycle Action Schemas
// ---------------------------------------------------------------------------

export const createRemoteSupportSessionSchema = z.object({
  issueSummary: nonEmptyString
    .min(5, 'Describe the issue in at least 5 characters')
    .max(500, 'Issue summary must be 500 characters or fewer'),
  departmentSlug: z.string().trim().min(1).max(64).optional(),
  clientDiagnostics: clientDiagnosticsSchema.optional(),
});
export type CreateRemoteSupportSessionInput = z.infer<typeof createRemoteSupportSessionSchema>;

export const claimRemoteSupportSessionSchema = z
  .object({
    sessionId: uuidSchema.optional(),
    sessionCode: remoteSupportCodeSchema.optional(),
  })
  .refine((val) => Boolean(val.sessionId || val.sessionCode), {
    message: 'Provide either sessionId or a 6-digit sessionCode',
  });
export type ClaimRemoteSupportSessionInput = z.infer<typeof claimRemoteSupportSessionSchema>;

export const respondRemoteSupportConsentSchema = z.object({
  sessionId: uuidSchema,
  approved: z.boolean(),
  rejectionReason: z.string().trim().max(300).optional(),
});
export type RespondRemoteSupportConsentInput = z.infer<typeof respondRemoteSupportConsentSchema>;

export const toggleCobrowseSchema = z.object({
  sessionId: uuidSchema,
  enabled: z.boolean(),
});
export type ToggleCobrowseInput = z.infer<typeof toggleCobrowseSchema>;

export const endRemoteSupportSessionSchema = z.object({
  sessionId: uuidSchema,
  endReason: z.string().trim().max(200).optional(),
  resolutionNotes: z.string().trim().max(1000).optional(),
  isRevoked: z.boolean().optional(),
});
export type EndRemoteSupportSessionInput = z.infer<typeof endRemoteSupportSessionSchema>;

export const initiateTier2ConsentSessionSchema = z.object({
  deviceId: uuidSchema,
  targetEmployeeId: uuidSchema.optional(),
  issueSummary: nonEmptyString.min(5).max(500),
  justificationReason: z.string().trim().max(500).optional(),
});
export type InitiateTier2ConsentSessionInput = z.infer<typeof initiateTier2ConsentSessionSchema>;

// ---------------------------------------------------------------------------
// Managed Devices & Tier 2 Launch Schemas
// ---------------------------------------------------------------------------

export const protocolOptionsSchema = z
  .object({
    security: z.enum(['nla', 'tls', 'rdp', 'any']).optional(),
    ignoreCert: z.boolean().optional(),
    domain: z.string().trim().max(120).optional(),
    colorDepth: z.union([z.literal(16), z.literal(24), z.literal(32)]).optional(),
    resizeMethod: z.enum(['display-update', 'reconnect']).optional(),
    readOnly: z.boolean().optional(),
  })
  .strict();
export type ProtocolOptions = z.infer<typeof protocolOptionsSchema>;

export const createRemoteSupportDeviceSchema = z.object({
  id: uuidSchema.optional(),
  hostname: nonEmptyString
    .max(128)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Hostname may contain only letters, digits, dots, hyphens, and underscores'
    ),
  displayName: nonEmptyString.max(120),
  siteId: uuidSchema.nullable().optional(),
  departmentId: uuidSchema.nullable().optional(),
  assignedEmployeeId: uuidSchema.nullable().optional(),
  deviceClass: remoteSupportDeviceClassSchema,
  protocol: remoteSupportProtocolSchema,
  networkHost: nonEmptyString.max(255),
  networkPort: z.number().int().min(1).max(65535),
  protocolOptions: protocolOptionsSchema.optional(),
  requireUserConsent: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export type CreateRemoteSupportDeviceInput = z.infer<typeof createRemoteSupportDeviceSchema>;

export const launchTier2DesktopSchema = z.object({
  deviceId: uuidSchema,
  sessionId: uuidSchema,
  username: z.string().trim().max(120).optional(),
  password: z.string().max(256).optional(),
  domain: z.string().trim().max(120).optional(),
  justificationReason: z.string().trim().max(500).optional(),
});
export type LaunchTier2DesktopInput = z.infer<typeof launchTier2DesktopSchema>;

export const tier2LaunchResponseSchema = z.object({
  gatewayWsUrl: z.string().min(1),
  token: z.string().min(1),
  expiresAt: z.string(),
  protocol: remoteSupportProtocolSchema,
  hostname: z.string(),
});
export type Tier2LaunchResponse = z.infer<typeof tier2LaunchResponseSchema>;

export const iceServerConfigSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServerConfig = z.infer<typeof iceServerConfigSchema>;

export const iceServersRequestSchema = z.object({
  sessionId: uuidSchema,
});
export type IceServersRequestInput = z.infer<typeof iceServersRequestSchema>;

export const iceServersResponseSchema = z.object({
  iceServers: z.array(iceServerConfigSchema),
  relayAvailable: z.boolean(),
  provider: z.enum(['cloudflare_calls', 'coturn_hmac', 'stun_fallback']),
  ttlSeconds: z.number().int().positive(),
});
export type IceServersResponse = z.infer<typeof iceServersResponseSchema>;

// ---------------------------------------------------------------------------
// WebRTC Signaling & DataChannel Message Envelopes
// ---------------------------------------------------------------------------

export const webrtcSignalEnvelopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('offer'),
    senderId: z.string().min(1),
    sdp: z.string().min(1),
  }),
  z.object({
    type: z.literal('answer'),
    senderId: z.string().min(1),
    sdp: z.string().min(1),
  }),
  z.object({
    type: z.literal('ice_candidate'),
    senderId: z.string().min(1),
    candidate: z.object({
      candidate: z.string(),
      sdpMid: z.string().nullable().optional(),
      sdpMLineIndex: z.number().int().nullable().optional(),
    }),
  }),
  z.object({
    type: z.literal('consent_request'),
    senderId: z.string().min(1),
    agentName: z.string().min(1),
    agentRole: z.string().min(1),
    tier: remoteSupportTierSchema,
    deviceName: z.string().optional(),
  }),
  z.object({
    type: z.literal('consent_response'),
    senderId: z.string().min(1),
    approved: z.boolean(),
  }),
  z.object({
    type: z.literal('session_end'),
    senderId: z.string().min(1),
    reason: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal('viewer_ready'),
    senderId: z.string().min(1),
  }),
]);
export type WebRtcSignalEnvelope = z.infer<typeof webrtcSignalEnvelopeSchema>;

const normalizedCoordSchema = z.number().min(0).max(1);

export const assistDataChannelMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pointer_move'),
    x: normalizedCoordSchema,
    y: normalizedCoordSchema,
  }),
  z.object({
    type: z.literal('pointer_click'),
    x: normalizedCoordSchema,
    y: normalizedCoordSchema,
  }),
  z.object({
    type: z.literal('annotation_stroke'),
    id: z.string().min(1).max(64),
    color: z.enum(['gold', 'blue', 'red']),
    points: z
      .array(z.object({ x: normalizedCoordSchema, y: normalizedCoordSchema }))
      .min(1)
      .max(200),
  }),
  z.object({
    type: z.literal('annotation_clear'),
  }),
  z.object({
    type: z.literal('cobrowse_request'),
    agentName: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal('cobrowse_decision'),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal('cobrowse_action'),
    action: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('click'),
        x: normalizedCoordSchema,
        y: normalizedCoordSchema,
      }),
      z.object({
        kind: z.literal('scroll'),
        deltaX: z.number().min(-4000).max(4000),
        deltaY: z.number().min(-4000).max(4000),
      }),
      z.object({
        kind: z.literal('input'),
        x: normalizedCoordSchema,
        y: normalizedCoordSchema,
        value: z.string().max(500),
      }),
      z.object({
        kind: z.literal('navigate'),
        path: z.string().startsWith('/').max(200),
      }),
    ]),
  }),
  z.object({
    type: z.literal('chat_message'),
    id: z.string().min(1).max(64),
    senderName: z.string().min(1).max(120),
    senderRole: z.enum(['requester', 'agent']),
    text: z.string().min(1).max(1000),
    sentAt: z.string().max(64),
  }),
  z.object({
    type: z.literal('diagnostics_snapshot'),
    diagnostics: clientDiagnosticsSchema,
  }),
]);
export type AssistDataChannelMessage = z.infer<typeof assistDataChannelMessageSchema>;
