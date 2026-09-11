---
tick_id: "tick-20260911-102914-shift-integrity"
loop_id: "shift-integrity"
department: "control-room"
authority_level: "L2"
created_at: "2026-09-11T08:29:14Z"
signal: "periodic_scheduled_tick"
dry_run: false
---

# Operational Brief: shift-integrity

## 1. Context & Ingested Signal
- **Loop:** `shift-integrity`
- **Department:** `control-room`
- **Signal:** `periodic_scheduled_tick`
- **Authority Requested:** `L2`

## 2. Hypothesis & Purpose
Evaluate current health and drift within the `control-room` domain. Ensure adherence to corporate quality gates and system safety policies.

## 3. Operational Plan
1. Ingest telemetry and workspace state.
2. Verify policy assertions and test suites.
3. Capture evidence artifacts in `.agents/corpos/storage/artifacts/tick-20260911-102914-shift-integrity/`.
4. Re-calculate adaptive scheduling interval.
