'use client';

import type {
  IntegrationRole,
  IntegrationRules,
  IntegrationShiftWindow,
  IntegrationTriggerOperator,
} from '@repo/contract/schemas/integration.schema';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Play, ShieldAlert, Sparkles } from 'lucide-react';
import { useState } from 'react';

export const AVAILABLE_INTEGRATION_ROLES: readonly {
  readonly id: IntegrationRole;
  readonly label: string;
}[] = [
  { id: 'admin', label: 'Admin' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'control_room_operator', label: 'Control Room' },
  { id: 'operator', label: 'Operator' },
] as const;

export const AVAILABLE_TRIGGER_EVENTS: readonly {
  readonly id: string;
  readonly label: string;
}[] = [
  { id: 'breakdown.created', label: 'Breakdown Created' },
  { id: 'shift.closeout', label: 'Shift Closeout' },
  { id: 'plant.density_excursion', label: 'Plant Density Excursion' },
  { id: 'scada.alarm_critical', label: 'SCADA Critical Alarm' },
  { id: 'vercel.deployment.error', label: 'Vercel Deployment Error' },
  { id: 'vercel.firewall.attack', label: 'Vercel Firewall Attack' },
] as const;

const DEFAULT_RATE_LIMIT_PER_MIN = 30;
const DEFAULT_MAX_PAYLOAD_BYTES = 65536;
const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 5;
const DAY_SHIFT_START_HOUR = 6;
const DAY_SHIFT_END_HOUR = 18;
const REDACTED_PLACEHOLDER = '[REDACTED]';

export interface IntegrationRulesFormState {
  allowedRoles: IntegrationRole[];
  activeShift: IntegrationShiftWindow;
  rateLimitPerMin: string;
  requireHumanApproval: boolean;
  triggerEvents: string[];
  thresholdMetric: string;
  thresholdOperator: IntegrationTriggerOperator;
  thresholdValue: string;
  blockedArgKeys: string;
  redactFields: string;
  maxPayloadBytes: string;
  writeToolOverrides: string;
  egressDomainAllowlist: string;
  circuitBreakerThreshold: string;
}

export const DEFAULT_RULES_FORM_STATE: IntegrationRulesFormState = {
  allowedRoles: ['admin', 'supervisor'],
  activeShift: 'all',
  rateLimitPerMin: String(DEFAULT_RATE_LIMIT_PER_MIN),
  requireHumanApproval: false,
  triggerEvents: [],
  thresholdMetric: '',
  thresholdOperator: 'gt',
  thresholdValue: '',
  blockedArgKeys: '',
  redactFields: '',
  maxPayloadBytes: String(DEFAULT_MAX_PAYLOAD_BYTES),
  writeToolOverrides: '',
  egressDomainAllowlist: '',
  circuitBreakerThreshold: String(DEFAULT_CIRCUIT_BREAKER_THRESHOLD),
};

export interface IntegrationRulePreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly state: IntegrationRulesFormState;
}

export const INTEGRATION_RULE_PRESETS: readonly IntegrationRulePreset[] = [
  {
    id: 'strict-read-only',
    label: 'Strict Read-Only',
    description: 'Read-only access for Admin/Supervisor/Control Room with secret redaction.',
    state: {
      ...DEFAULT_RULES_FORM_STATE,
      allowedRoles: ['admin', 'supervisor', 'control_room_operator'],
      activeShift: 'all',
      rateLimitPerMin: '60',
      requireHumanApproval: false,
      blockedArgKeys: 'raw_sql, drop_table, delete',
      redactFields: 'password, secret, api_key, token',
      circuitBreakerThreshold: '5',
    },
  },
  {
    id: 'day-shift-automation',
    label: 'Day-Shift Automation',
    description: 'Day shift (06:00–18:00) with auto-triggers on breakdowns & cyclone density.',
    state: {
      ...DEFAULT_RULES_FORM_STATE,
      allowedRoles: ['admin', 'supervisor', 'control_room_operator'],
      activeShift: 'day',
      rateLimitPerMin: '30',
      requireHumanApproval: false,
      triggerEvents: ['breakdown.created', 'plant.density_excursion', 'scada.alarm_critical'],
      thresholdMetric: 'cycloneRd',
      thresholdOperator: 'gt',
      thresholdValue: '1.55',
      circuitBreakerThreshold: '3',
    },
  },
  {
    id: 'high-security-write',
    label: 'High-Security Write Gate',
    description: 'Admin/Supervisor only, human confirmation required, 10 req/min cap.',
    state: {
      ...DEFAULT_RULES_FORM_STATE,
      allowedRoles: ['admin', 'supervisor'],
      activeShift: 'all',
      rateLimitPerMin: '10',
      requireHumanApproval: true,
      blockedArgKeys: 'force, bypass_interlock, raw_sql',
      redactFields: 'password, token, secret, badge_pin',
      maxPayloadBytes: '16384',
      circuitBreakerThreshold: '2',
    },
  },
  {
    id: 'lsp-code-intelligence',
    label: 'LSP & Schema Intelligence',
    description: 'High-throughput 120 req/min for all roles with shell/disk write blocks.',
    state: {
      ...DEFAULT_RULES_FORM_STATE,
      allowedRoles: ['admin', 'supervisor', 'control_room_operator', 'operator'],
      activeShift: 'all',
      rateLimitPerMin: '120',
      requireHumanApproval: false,
      blockedArgKeys: 'exec_shell, write_disk',
      redactFields: 'connection_string, service_role_key',
      maxPayloadBytes: '262144',
      circuitBreakerThreshold: '10',
    },
  },
] as const;

function splitCsvList(rawText: string): string[] {
  return rawText
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function buildRulesPayloadFromForm(
  rulesForm: Readonly<IntegrationRulesFormState>
): IntegrationRules {
  const rateLimitNum = Number.parseInt(rulesForm.rateLimitPerMin, 10);
  const maxBytesNum = Number.parseInt(rulesForm.maxPayloadBytes, 10);
  const cbNum = Number.parseInt(rulesForm.circuitBreakerThreshold, 10);
  const thresholdValNum = Number.parseFloat(rulesForm.thresholdValue);

  const blockedKeys = splitCsvList(rulesForm.blockedArgKeys);
  const redactedKeys = splitCsvList(rulesForm.redactFields);
  const writeOverrides = splitCsvList(rulesForm.writeToolOverrides);
  const egressDomains = splitCsvList(rulesForm.egressDomainAllowlist);

  return {
    ...(rulesForm.allowedRoles.length > 0 ? { allowed_roles: rulesForm.allowedRoles } : {}),
    active_shift: rulesForm.activeShift,
    ...(Number.isFinite(rateLimitNum) && rateLimitNum >= 1 && rateLimitNum <= 600
      ? { rate_limit_per_min: rateLimitNum }
      : {}),
    require_human_approval: rulesForm.requireHumanApproval,
    ...(rulesForm.triggerEvents.length > 0 ? { trigger_events: rulesForm.triggerEvents } : {}),
    ...(rulesForm.thresholdMetric.trim().length > 0 && Number.isFinite(thresholdValNum)
      ? {
          threshold_metric: rulesForm.thresholdMetric.trim(),
          threshold_operator: rulesForm.thresholdOperator,
          threshold_value: thresholdValNum,
        }
      : {}),
    ...(blockedKeys.length > 0 ? { blocked_arg_keys: blockedKeys } : {}),
    ...(redactedKeys.length > 0 ? { redact_fields: redactedKeys } : {}),
    ...(Number.isFinite(maxBytesNum) && maxBytesNum >= 256 && maxBytesNum <= 1048576
      ? { max_payload_bytes: maxBytesNum }
      : {}),
    ...(writeOverrides.length > 0 ? { write_tool_overrides: writeOverrides } : {}),
    ...(egressDomains.length > 0 ? { egress_domain_allowlist: egressDomains } : {}),
    ...(Number.isFinite(cbNum) && cbNum >= 1 && cbNum <= 50
      ? { circuit_breaker_threshold: cbNum }
      : {}),
  };
}

export function rulesFormFromConfig(
  config: Readonly<Record<string, unknown>> | undefined
): IntegrationRulesFormState {
  const rawRules =
    config && typeof config.rules === 'object' && config.rules !== null
      ? (config.rules as IntegrationRules)
      : {};

  return {
    allowedRoles: rawRules.allowed_roles ?? ['admin', 'supervisor'],
    activeShift: rawRules.active_shift ?? 'all',
    rateLimitPerMin: String(rawRules.rate_limit_per_min ?? DEFAULT_RATE_LIMIT_PER_MIN),
    requireHumanApproval: Boolean(rawRules.require_human_approval),
    triggerEvents: rawRules.trigger_events ?? [],
    thresholdMetric: rawRules.threshold_metric ?? '',
    thresholdOperator: rawRules.threshold_operator ?? 'gt',
    thresholdValue:
      typeof rawRules.threshold_value === 'number' ? String(rawRules.threshold_value) : '',
    blockedArgKeys: (rawRules.blocked_arg_keys ?? []).join(', '),
    redactFields: (rawRules.redact_fields ?? []).join(', '),
    maxPayloadBytes: String(rawRules.max_payload_bytes ?? DEFAULT_MAX_PAYLOAD_BYTES),
    writeToolOverrides: (rawRules.write_tool_overrides ?? []).join(', '),
    egressDomainAllowlist: (rawRules.egress_domain_allowlist ?? []).join(', '),
    circuitBreakerThreshold: String(
      rawRules.circuit_breaker_threshold ?? DEFAULT_CIRCUIT_BREAKER_THRESHOLD
    ),
  };
}

export interface DryRunSimulationInput {
  readonly role: IntegrationRole;
  readonly hourOfDay: number;
  readonly isApproved: boolean;
  readonly endpointHost: string;
  readonly eventName: string;
  readonly metricValue?: number;
  readonly samplePayloadJson: string;
}

export interface DryRunSimulationResult {
  readonly verdict: 'ALLOW' | 'DENY';
  readonly reasons: readonly string[];
  readonly triggerFired: boolean;
  readonly sanitizedPayload: Record<string, unknown>;
}

const DRY_RUN_COMPARATORS: Readonly<
  Record<IntegrationTriggerOperator, (metricVal: number, targetVal: number) => boolean>
> = {
  gt: (metricVal, targetVal) => metricVal > targetVal,
  gte: (metricVal, targetVal) => metricVal >= targetVal,
  lt: (metricVal, targetVal) => metricVal < targetVal,
  lte: (metricVal, targetVal) => metricVal <= targetVal,
  eq: (metricVal, targetVal) => metricVal === targetVal,
};

export function simulateIntegrationRulesDryRun(
  rulesForm: Readonly<IntegrationRulesFormState>,
  simInput: Readonly<DryRunSimulationInput>
): DryRunSimulationResult {
  const rules = buildRulesPayloadFromForm(rulesForm);
  const reasons: string[] = [];
  let denied = false;

  // 1. Role check
  if (
    rules.allowed_roles &&
    rules.allowed_roles.length > 0 &&
    !rules.allowed_roles.includes(simInput.role)
  ) {
    denied = true;
    reasons.push(`Role "${simInput.role}" is not in allowed_roles`);
  } else {
    reasons.push(`Role "${simInput.role}" permitted`);
  }

  // 2. Shift check
  if (rules.active_shift && rules.active_shift !== 'all') {
    const isDay =
      simInput.hourOfDay >= DAY_SHIFT_START_HOUR && simInput.hourOfDay < DAY_SHIFT_END_HOUR;
    const shiftMatches = rules.active_shift === 'day' ? isDay : !isDay;
    if (!shiftMatches) {
      denied = true;
      reasons.push(`Hour ${simInput.hourOfDay}:00 is outside "${rules.active_shift}" shift window`);
    } else {
      reasons.push(`Shift window "${rules.active_shift}" satisfied`);
    }
  }

  // 3. Human approval check
  if (rules.require_human_approval && !simInput.isApproved) {
    denied = true;
    reasons.push('Human confirmation gate required but call is unapproved');
  }

  // 4. Egress domain check
  if (rules.egress_domain_allowlist && rules.egress_domain_allowlist.length > 0) {
    const host = simInput.endpointHost.trim().toLowerCase();
    const hostAllowed = rules.egress_domain_allowlist.some((domain) => {
      const normalized = domain.trim().toLowerCase();
      return host === normalized || host.endsWith(`.${normalized}`);
    });
    if (!hostAllowed) {
      denied = true;
      reasons.push(`Host "${host}" is not in egress_domain_allowlist`);
    } else {
      reasons.push(`Host "${host}" matches egress allowlist`);
    }
  }

  // 5. Payload parsing, size, blocked keys, and redaction
  let parsedPayload: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(simInput.samplePayloadJson || '{}') as unknown;
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      parsedPayload = { ...(raw as Record<string, unknown>) };
    }
  } catch {
    denied = true;
    reasons.push('Sample payload is not valid JSON');
  }

  const byteLen = new TextEncoder().encode(JSON.stringify(parsedPayload)).byteLength;
  if (typeof rules.max_payload_bytes === 'number' && byteLen > rules.max_payload_bytes) {
    denied = true;
    reasons.push(
      `Payload size (${byteLen} B) exceeds max_payload_bytes (${rules.max_payload_bytes} B)`
    );
  }

  if (rules.blocked_arg_keys && rules.blocked_arg_keys.length > 0) {
    const blockedSet = new Set(rules.blocked_arg_keys.map((k) => k.toLowerCase()));
    const hitKey = Object.keys(parsedPayload).find((k) => blockedSet.has(k.toLowerCase()));
    if (hitKey) {
      denied = true;
      reasons.push(`Argument "${hitKey}" is blocked by blocked_arg_keys`);
    }
  }

  const sanitizedPayload: Record<string, unknown> = { ...parsedPayload };
  if (rules.redact_fields && rules.redact_fields.length > 0) {
    const redactSet = new Set(rules.redact_fields.map((k) => k.toLowerCase()));
    for (const key of Object.keys(sanitizedPayload)) {
      if (redactSet.has(key.toLowerCase())) {
        sanitizedPayload[key] = REDACTED_PLACEHOLDER;
        reasons.push(`Redacted field "${key}"`);
      }
    }
  }

  // 6. Trigger evaluation
  const eventMatched = Boolean(
    rules.trigger_events &&
      rules.trigger_events.length > 0 &&
      simInput.eventName &&
      rules.trigger_events.includes(simInput.eventName)
  );
  const thresholdMatched = Boolean(
    rules.threshold_metric &&
      rules.threshold_operator &&
      typeof rules.threshold_value === 'number' &&
      typeof simInput.metricValue === 'number' &&
      DRY_RUN_COMPARATORS[rules.threshold_operator](simInput.metricValue, rules.threshold_value)
  );

  return {
    verdict: denied ? 'DENY' : 'ALLOW',
    reasons,
    triggerFired: eventMatched || thresholdMatched,
    sanitizedPayload,
  };
}

const SELECT_CLASS =
  'rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs';

const PILL_ACTIVE_CLASS =
  'cursor-pointer rounded-full border border-[var(--accent-blue)] bg-[var(--accent-blue)] px-2.5 py-0.5 font-medium text-[11px] text-white';

const PILL_INACTIVE_CLASS =
  'cursor-pointer rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]';

interface IntegrationRulesFieldsProps {
  readonly idPrefix: string;
  readonly rulesForm: IntegrationRulesFormState;
  readonly onChange: (next: IntegrationRulesFormState) => void;
  readonly onSave?: () => void;
  readonly saving?: boolean;
}

export function IntegrationRulesFields({
  idPrefix,
  rulesForm,
  onChange,
  onSave,
  saving = false,
}: IntegrationRulesFieldsProps) {
  const [showSimulator, setShowSimulator] = useState(false);
  const [simRole, setSimRole] = useState<IntegrationRole>('supervisor');
  const [simHour, setSimHour] = useState('10');
  const [simApproved, setSimApproved] = useState(false);
  const [simHost, setSimHost] = useState('mcp.sentry.dev');
  const [simPayload, setSimPayload] = useState('{"query":"SELECT 1","api_key":"sk-secret"}');
  const [simResult, setSimResult] = useState<DryRunSimulationResult | null>(null);

  const toggleRole = (role: IntegrationRole) => {
    const exists = rulesForm.allowedRoles.includes(role);
    const nextRoles = exists
      ? rulesForm.allowedRoles.filter((r) => r !== role)
      : [...rulesForm.allowedRoles, role];
    onChange({ ...rulesForm, allowedRoles: nextRoles });
  };

  const toggleTriggerEvent = (eventId: string) => {
    const exists = rulesForm.triggerEvents.includes(eventId);
    const nextEvents = exists
      ? rulesForm.triggerEvents.filter((ev) => ev !== eventId)
      : [...rulesForm.triggerEvents, eventId];
    onChange({ ...rulesForm, triggerEvents: nextEvents });
  };

  const runDryRun = () => {
    const hourNum = Number.parseInt(simHour, 10);
    const outcome = simulateIntegrationRulesDryRun(rulesForm, {
      role: simRole,
      hourOfDay: Number.isFinite(hourNum) ? hourNum : 10,
      isApproved: simApproved,
      endpointHost: simHost,
      eventName: rulesForm.triggerEvents[0] ?? 'breakdown.created',
      metricValue: rulesForm.thresholdValue
        ? Number.parseFloat(rulesForm.thresholdValue) + 0.1
        : undefined,
      samplePayloadJson: simPayload,
    });
    setSimResult(outcome);
  };

  return (
    <div
      data-testid={`integration-rules-panel-${idPrefix}`}
      className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/45 p-4 md:col-span-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[var(--accent-blue)]" />
          <span className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
            4-Pillar Integration Rules &amp; Governance Policy
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowSimulator((prev) => !prev)}
          >
            <Play className="mr-1 h-3 w-3" />
            {showSimulator ? 'Hide Dry-Run' : 'Policy Dry-Run'}
          </Button>
          {onSave && (
            <Button type="button" size="sm" disabled={saving} onClick={onSave}>
              {saving ? 'Saving Rules…' : 'Save Policy Rules'}
            </Button>
          )}
        </div>
      </div>

      {/* One-Click Governance Presets Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2">
        <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-[var(--text-secondary)]">
          <Sparkles className="h-3 w-3 text-[var(--accent-blue)]" />
          Rule Presets:
        </span>
        {INTEGRATION_RULE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.description}
            onClick={() => onChange(preset.state)}
            className={PILL_INACTIVE_CLASS}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Pillar 1: Access & Governance Rules */}
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <p className="font-semibold text-[var(--text-heading)] text-xs">
            1. Access &amp; Governance Rules
          </p>
          <div className="space-y-1">
            <span className="block text-[11px] text-[var(--text-muted)]">Allowed Roles:</span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_INTEGRATION_ROLES.map((role) => {
                const isSelected = rulesForm.allowedRoles.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleRole(role.id)}
                    className={isSelected ? PILL_ACTIVE_CLASS : PILL_INACTIVE_CLASS}
                  >
                    {role.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <label
              htmlFor={`${idPrefix}-active-shift`}
              className="space-y-1 text-[11px] text-[var(--text-secondary)]"
            >
              <span>Shift Schedule</span>
              <select
                id={`${idPrefix}-active-shift`}
                name={`${idPrefix}-active-shift`}
                aria-label="Shift Schedule Rule"
                value={rulesForm.activeShift}
                onChange={(e) =>
                  onChange({
                    ...rulesForm,
                    activeShift: e.target.value as IntegrationShiftWindow,
                  })
                }
                className={`${SELECT_CLASS} w-full`}
              >
                <option value="all">24/7 (All Shifts)</option>
                <option value="day">Day Shift Only (06:00–18:00)</option>
                <option value="night">Night Shift Only (18:00–06:00)</option>
              </select>
            </label>

            <label
              htmlFor={`${idPrefix}-rate-limit`}
              className="space-y-1 text-[11px] text-[var(--text-secondary)]"
            >
              <span>Rate Limit (calls/min)</span>
              <Input
                id={`${idPrefix}-rate-limit`}
                name={`${idPrefix}-rate-limit`}
                aria-label="Rate Limit Calls Per Minute"
                type="number"
                min={1}
                max={600}
                value={rulesForm.rateLimitPerMin}
                onChange={(e) => onChange({ ...rulesForm, rateLimitPerMin: e.target.value })}
                className="h-8 text-xs"
              />
            </label>
          </div>

          <label
            htmlFor={`${idPrefix}-human-approval`}
            className="flex items-center gap-2 pt-1 text-[var(--text-secondary)] text-xs"
          >
            <input
              id={`${idPrefix}-human-approval`}
              name={`${idPrefix}-human-approval`}
              type="checkbox"
              checked={rulesForm.requireHumanApproval}
              onChange={(e) => onChange({ ...rulesForm, requireHumanApproval: e.target.checked })}
            />
            Require human confirmation for all tool calls
          </label>
        </div>

        {/* Pillar 2: Event & Threshold Trigger Rules */}
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <p className="font-semibold text-[var(--text-heading)] text-xs">
            2. Event &amp; Threshold Trigger Rules
          </p>
          <div className="space-y-1">
            <span className="block text-[11px] text-[var(--text-muted)]">Auto-Trigger Events:</span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TRIGGER_EVENTS.map((ev) => {
                const isSelected = rulesForm.triggerEvents.includes(ev.id);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleTriggerEvent(ev.id)}
                    className={isSelected ? PILL_ACTIVE_CLASS : PILL_INACTIVE_CLASS}
                  >
                    {ev.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <Input
              id={`${idPrefix}-threshold-metric`}
              name={`${idPrefix}-threshold-metric`}
              aria-label="Threshold Metric Field"
              placeholder="Metric (e.g. cycloneRd)"
              value={rulesForm.thresholdMetric}
              onChange={(e) => onChange({ ...rulesForm, thresholdMetric: e.target.value })}
              className="h-8 text-xs"
            />
            <select
              id={`${idPrefix}-threshold-op`}
              name={`${idPrefix}-threshold-op`}
              aria-label="Threshold Operator"
              value={rulesForm.thresholdOperator}
              onChange={(e) =>
                onChange({
                  ...rulesForm,
                  thresholdOperator: e.target.value as IntegrationTriggerOperator,
                })
              }
              className={SELECT_CLASS}
            >
              <option value="gt">&gt; Greater than</option>
              <option value="gte">&ge; Greater or equal</option>
              <option value="lt">&lt; Less than</option>
              <option value="lte">&le; Less or equal</option>
              <option value="eq">= Equal to</option>
            </select>
            <Input
              id={`${idPrefix}-threshold-val`}
              name={`${idPrefix}-threshold-val`}
              aria-label="Threshold Metric Value"
              type="number"
              step="any"
              placeholder="Value (e.g. 1.52)"
              value={rulesForm.thresholdValue}
              onChange={(e) => onChange({ ...rulesForm, thresholdValue: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Pillar 3: Tool & Payload Policy Rules */}
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <p className="font-semibold text-[var(--text-heading)] text-xs">
            3. Tool &amp; Payload Policy Rules
          </p>
          <Input
            id={`${idPrefix}-blocked-args`}
            name={`${idPrefix}-blocked-args`}
            aria-label="Blocked Argument Keys"
            placeholder="Blocked arg keys (comma-separated, e.g. raw_sql, password)"
            value={rulesForm.blockedArgKeys}
            onChange={(e) => onChange({ ...rulesForm, blockedArgKeys: e.target.value })}
            className="h-8 text-xs"
          />
          <Input
            id={`${idPrefix}-redact-fields`}
            name={`${idPrefix}-redact-fields`}
            aria-label="Redacted Argument Fields"
            placeholder="Redacted arg keys (comma-separated, e.g. api_token, ssn)"
            value={rulesForm.redactFields}
            onChange={(e) => onChange({ ...rulesForm, redactFields: e.target.value })}
            className="h-8 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              id={`${idPrefix}-write-overrides`}
              name={`${idPrefix}-write-overrides`}
              aria-label="Write Tool Overrides"
              placeholder="Write-override tools (CSV)"
              value={rulesForm.writeToolOverrides}
              onChange={(e) => onChange({ ...rulesForm, writeToolOverrides: e.target.value })}
              className="h-8 text-xs"
            />
            <Input
              id={`${idPrefix}-max-payload`}
              name={`${idPrefix}-max-payload`}
              aria-label="Max Payload Size Bytes"
              type="number"
              min={256}
              max={1048576}
              placeholder="Max payload bytes"
              value={rulesForm.maxPayloadBytes}
              onChange={(e) => onChange({ ...rulesForm, maxPayloadBytes: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Pillar 4: Network & Egress Rules */}
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <p className="font-semibold text-[var(--text-heading)] text-xs">
            4. Network &amp; Egress Rules
          </p>
          <Input
            id={`${idPrefix}-egress-domains`}
            name={`${idPrefix}-egress-domains`}
            aria-label="Egress Domain Allowlist"
            placeholder="Egress domain allowlist (CSV, e.g. mcp.sentry.dev, mcp.vercel.com)"
            value={rulesForm.egressDomainAllowlist}
            onChange={(e) => onChange({ ...rulesForm, egressDomainAllowlist: e.target.value })}
            className="h-8 text-xs"
          />
          <label
            htmlFor={`${idPrefix}-circuit-breaker`}
            className="block space-y-1 text-[11px] text-[var(--text-secondary)]"
          >
            <span>Circuit Breaker Threshold (consecutive errors before auto-trip)</span>
            <Input
              id={`${idPrefix}-circuit-breaker`}
              name={`${idPrefix}-circuit-breaker`}
              aria-label="Circuit Breaker Threshold"
              type="number"
              min={1}
              max={50}
              value={rulesForm.circuitBreakerThreshold}
              onChange={(e) => onChange({ ...rulesForm, circuitBreakerThreshold: e.target.value })}
              className="h-8 text-xs"
            />
          </label>
        </div>
      </div>

      {/* Interactive Policy Dry-Run Simulator */}
      {showSimulator && (
        <div
          data-testid={`integration-rules-simulator-${idPrefix}`}
          className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--text-heading)] text-xs">
              Interactive 4-Pillar Policy Dry-Run Simulator
            </span>
            <Button type="button" size="sm" onClick={runDryRun}>
              Evaluate Policy Now
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <select
              id={`${idPrefix}-sim-role`}
              name={`${idPrefix}-sim-role`}
              aria-label="Simulated Caller Role"
              value={simRole}
              onChange={(e) => setSimRole(e.target.value as IntegrationRole)}
              className={SELECT_CLASS}
            >
              {AVAILABLE_INTEGRATION_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  Role: {r.label}
                </option>
              ))}
            </select>

            <Input
              id={`${idPrefix}-sim-hour`}
              name={`${idPrefix}-sim-hour`}
              aria-label="Simulated Hour of Day"
              type="number"
              min={0}
              max={23}
              value={simHour}
              onChange={(e) => setSimHour(e.target.value)}
              placeholder="Hour (0-23)"
              className="h-8 text-xs"
            />

            <Input
              id={`${idPrefix}-sim-host`}
              name={`${idPrefix}-sim-host`}
              aria-label="Simulated Endpoint Host"
              value={simHost}
              onChange={(e) => setSimHost(e.target.value)}
              placeholder="Endpoint host"
              className="h-8 text-xs"
            />

            <label
              htmlFor={`${idPrefix}-sim-approved`}
              className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs"
            >
              <input
                id={`${idPrefix}-sim-approved`}
                name={`${idPrefix}-sim-approved`}
                type="checkbox"
                checked={simApproved}
                onChange={(e) => setSimApproved(e.target.checked)}
              />
              Human Approved
            </label>
          </div>

          <Input
            id={`${idPrefix}-sim-payload`}
            name={`${idPrefix}-sim-payload`}
            aria-label="Simulated JSON Payload"
            value={simPayload}
            onChange={(e) => setSimPayload(e.target.value)}
            placeholder="Sample JSON arguments"
            className="h-8 font-mono text-xs"
          />

          {simResult && (
            <div className="space-y-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    simResult.verdict === 'ALLOW'
                      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700'
                      : 'border border-red-500/30 bg-red-500/15 text-red-700'
                  }
                >
                  Verdict: {simResult.verdict}
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  Auto-Trigger: {simResult.triggerFired ? 'FIRED' : 'IDLE'}
                </Badge>
              </div>
              <ul className="list-inside list-disc text-[11px] text-[var(--text-secondary)]">
                {simResult.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <pre className="overflow-x-auto rounded bg-[var(--bg-primary)] p-2 font-mono text-[11px] text-[var(--text-heading)]">
                {JSON.stringify(simResult.sanitizedPayload)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function IntegrationRuleSummaryBadges({
  config,
}: {
  readonly config: Readonly<Record<string, unknown>> | undefined;
}) {
  const rawRules =
    config && typeof config.rules === 'object' && config.rules !== null
      ? (config.rules as IntegrationRules)
      : null;

  if (!rawRules) {
    return null;
  }

  return (
    <>
      {rawRules.active_shift && rawRules.active_shift !== 'all' && (
        <Badge variant="outline" className="text-[11px]">
          Shift: {rawRules.active_shift}
        </Badge>
      )}
      {typeof rawRules.rate_limit_per_min === 'number' && (
        <Badge variant="outline" className="text-[11px]">
          Rate: {rawRules.rate_limit_per_min}/min
        </Badge>
      )}
      {rawRules.allowed_roles && rawRules.allowed_roles.length > 0 && (
        <Badge variant="outline" className="text-[11px]">
          Roles: {rawRules.allowed_roles.length}
        </Badge>
      )}
      {rawRules.trigger_events && rawRules.trigger_events.length > 0 && (
        <Badge variant="outline" className="text-[11px]">
          Triggers: {rawRules.trigger_events.length}
        </Badge>
      )}
      {typeof rawRules.circuit_breaker_threshold === 'number' && (
        <Badge variant="outline" className="text-[11px]">
          CB: {rawRules.circuit_breaker_threshold} err
        </Badge>
      )}
    </>
  );
}
