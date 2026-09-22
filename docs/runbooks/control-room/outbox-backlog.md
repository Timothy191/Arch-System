# Runbook: Outbox Backlog

**Severity:** High
**Impact:** SCADA degraded writes are stacking up and not draining to FUXA.

## Symptoms

- Outbox UI shows > 100 Queued.
- `control_room_outbox_pending_total` > 100.
- Alert: `OutboxDrainDelay`

## Actions

1. Check if FUXA is unreachable. If so, fix SCADA network.
2. Check if `/api/cron/outbox-drain` is firing.
3. Review DLQ (status='failed') for unrecoverable payloads.
