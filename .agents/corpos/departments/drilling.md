---
department_id: "drilling"
tier: "tier_1"
lead_role: "Chief Drilling Telemetry Engineer"
authority_ceiling: "L2"
purpose: "Drill rig penetration telemetry, bit depth tracking, blast pattern telemetry streaming, and pit extraction data feeds."
allowed_tools:
  [
    "read_file",
    "list_dir",
    "view_telemetry",
    "stream_drilling_feed",
    "generate_brief",
    "create_worktree",
  ]
---

# Department Blueprint: Drilling Telemetry & Blast Prep (Tier 1)

## 1. Department Mandate

The Drilling Telemetry department monitors drill rig penetration rates (ROP), bit depth sensors, hole pressure metrics, and blast pattern telemetry streams. It provides real-time data feeding pit extraction plans and explosive charge calculations.

## 2. Core Responsibilities

1. **Bit Depth & Penetration Telemetry**: Real-time SSE streaming (`/api/telemetry/drilling/stream`) monitoring drill rig telemetry in active pits.
2. **Blast Hole Depth Verification**: Compares actual drilled depth against geotechnical target depth before charging.
3. **Drill Rig Health & Bit Wear Monitoring**: Tracks rotation speed (RPM), pulldown force, and vibration anomalies to predict bit failure.
4. **Pit Extraction Alignment**: Feeds real-time telemetry to the Control Room for atomic shift closeout compilation.

## 3. Standard Operating Procedures (SOPs)

### SOP-DR-01: Underground Obstruction / Void Detection

- **Trigger**: Sudden penetration rate spike (> 200% baseline) with pulldown drop.
- **Action**:
  1. Pause drill rig auto-feed signal.
  2. Flag hole coordinates in `public.drilling_telemetry`.
  3. Emit real-time alert to pit supervisor and geotechnical team.

### SOP-DR-02: Telemetry SSE Stream Disconnection

- **Trigger**: SSE connection drop on `/api/telemetry/drilling/stream` > 15s.
- **Action**:
  1. Buffer telemetry records in local rig edge cache (`useOfflineQueue`).
  2. Re-establish SSE connection with exponential backoff and jitter.
  3. Flush buffered hole depth records upon reconnection without telemetry gap.

## 4. Hard Guardrails & Constraints

- **NEVER** clear blast pattern for charging until 100% of blast holes satisfy depth tolerance (±0.1m).
- **NEVER** overwrite raw drill telemetry records; all depth logs are append-only.
- **ALWAYS** stream telemetry with high-frequency timestamp precision (ISO 8601 UTC).
