---
id: "stack-monitor"
name: "Next.js / Supabase / Redis Auto-Healing Sentinel"
department: "control-room"
authority_level: "L1"
schedule:
  min_interval_minutes: 5
  max_interval_minutes: 60
  backoff_factor: 2.0
signals:
  - source: "periodic"
    interval: "adaptive"
  - source: "health-probe"
    event: "degraded"
verification:
  commands:
    - "curl -sI http://localhost:3000/api/health || exit 1"
---

# Business Loop: Stack Auto-Healing

## 1. Business Intent
Monitors the critical Next.js, Supabase, and Redis stack for downtime or degraded performance and automatically attempts self-healing via container restarts or service reloads.

## 2. Invariants & Guardrails
- **Max Restarts**: Do not restart more than 3 times per hour.
- **Dependency Order**: Ensure Redis and Supabase are up before restarting Next.js.
