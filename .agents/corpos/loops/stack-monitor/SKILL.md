# Skill: Auto-Heal Stack

## Objective
Detect degraded state in Next.js, Supabase, or Redis, and execute self-healing steps.

## Execution
1. Ping `/api/health` and check Redis connectivity.
2. If down, restart the corresponding Docker compose services (`docker-compose restart <service>`).
3. Log the auto-healing event to `AGENT_TRACER.md`.
