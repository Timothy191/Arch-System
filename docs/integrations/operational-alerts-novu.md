# Operational Alert Workflow Trigger System (Novu)

## Overview

The Arch-System operational alert trigger system validates operational events against `@repo/contract`, evaluates strict trigger and anti-noise suppression rules, applies bounded cooldown deduplication, and dispatches alerts through `sendOperationalAlert` (`@repo/utils/novu`).

## Architecture & Key Modules

- **Contracts & Schemas:** `packages/contract/src/schemas/operational-alerts.schema.ts`
- **Novu Transport:** `packages/utils/src/novu.ts` (`dispatchOperationalAlert`, `sendOperationalAlert`)
- **Trigger Router & Cooldown Store:** `apps/portal/lib/alerts/operational-alert-triggers.ts` (`evaluateOperationalAlertTrigger`, `triggerOperationalAlertWorkflow`, `resetAlertTriggerCooldowns`)

## Environment Configuration

| Variable       | Required                | Default               | Purpose                                                                                      |
| :------------- | :---------------------- | :-------------------- | :------------------------------------------------------------------------------------------- |
| `NOVU_API_KEY` | Yes (for live dispatch) | —                     | Novu secret key (`@novu/node`). When absent, triggers return `skipped_unconfigured` cleanly. |
| `NOVU_API_URL` | No                      | `https://api.novu.co` | Optional backend URL override passed to `Novu` client constructor.                           |

## Supported Event Types, Routing & Trigger Conditions

| Event Type (`eventType`)        | Source (`source`)                                                    | Workflow ID (`workflowId`)       | Default Subscriber   | Activation Condition                                                                  | Suppression (Normal Conditions)                                     | Cooldown |
| :------------------------------ | :------------------------------------------------------------------- | :------------------------------- | :------------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------ | :------- |
| `contractor.expiry.threshold`   | `cron.contractor-expiry`                                             | `contractor-expiry-alert`        | `access-control-ops` | `expiringCount >= thresholdCount` (default `1`)                                       | `expiringCount === 0`                                               | `3600s`  |
| `gate.heartbeat.fault`          | `api.access-control.gates.heartbeat`                                 | `access-control-gate-fault`      | `access-control-ops` | `faultMessage.trim().length > 0 && !isMaintenance`                                    | Empty `faultMessage` or `isMaintenance === true`                    | `300s`   |
| `visitor.auto_exit.completed`   | `cron.visitor-auto-exit`                                             | `visitor-auto-exit-alert`        | `access-control-ops` | `autoExitedCount > 0`                                                                 | `autoExitedCount === 0`                                             | `1800s`  |
| `equipment.breakdown.reported`  | `api.engineering.breakdown-alert` / `workflow.equipment-maintenance` | `equipment-breakdown-alert`      | `engineering-ops`    | Non-empty `equipmentId` and `description`                                             | Schema validation failure                                           | `600s`   |
| `equipment.breakdown.escalated` | `workflow.equipment-maintenance`                                     | `equipment-breakdown-escalation` | `management-ops`     | `status IN ('breakdown', 'maintenance') && downtimeHours >= escalationThresholdHours` | `status === 'operational'` or `downtimeHours < threshold`           | `3600s`  |
| `observability.slo.breached`    | `cron.observability-slo`                                             | `observability-slo-breach`       | `platform-ops`       | `sloBudgetState === 'CRITICAL'` or (`DEGRADED` and `sla24hPct < 99`)                  | `sloBudgetState === 'HEALTHY'` or `DEGRADED` with `sla24hPct >= 99` | `900s`   |
| `scada.telemetry.anomaly`       | `scada.telemetry-monitor`                                            | `scada-telemetry-anomaly`        | `control-room-ops`   | `quality !== 'GOOD (0x00)'` or `deviationSigma >= severityThresholdSigma`             | `quality === 'GOOD (0x00)'` and `deviationSigma < threshold`        | `300s`   |

## Validation, Deduplication & Error Handling

1. **Schema Validation (`operationalAlertEventSchema`):** Every call to `triggerOperationalAlertWorkflow` parses the event using Zod. Invalid payloads log a structured warning and return `{ status: 'validation_error', errorMessage }` without invoking Novu.
2. **Condition Evaluation:** Normal operating states return `{ status: 'suppressed', reason: 'condition_not_met', dedupeKey }` with zero network calls.
3. **Cooldown Deduplication:** A bounded in-memory map (`MAX_COOLDOWN_ENTRIES = 500`) prevents duplicate alert storms per `dedupeKey` within the route cooldown window (`{ status: 'suppressed', reason: 'cooldown_active', dedupeKey }`). Callers may pass `bypassCooldown: true` for manual overrides.
4. **Transport Hardening (`@repo/utils/novu`):** `dispatchOperationalAlert` trims and validates `subscriberId` and `workflowId` (`ValidationError`), verifies `NOVU_API_KEY`, and wraps Novu transport failures in `APIError` with `{ cause }` without exposing secrets. `triggerOperationalAlertWorkflow` catches delivery errors, logs via `@repo/logger/server`, and returns `{ status: 'delivery_error', errorMessage }` so cron jobs and telemetry handlers remain non-blocking.

## Integration Points

- `apps/portal/app/api/cron/contractor-expiry/route.ts`
- `apps/portal/app/api/access-control/gates/heartbeat/route.ts`
- `apps/portal/app/api/cron/visitor-auto-exit/route.ts`
- `apps/portal/app/api/cron/observability-slo/route.ts`
- `apps/portal/workflows/equipment-maintenance.ts`
