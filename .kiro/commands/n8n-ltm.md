# /n8n-ltm — LTM ↔ n8n Bridge

Bridge between Kiro's LTM memory system and n8n workflow engine. Enables vector-enhanced memory search and cross-session recall via n8n Pattern 4/5.

## Usage

```
/n8n-ltm search <query>           — Search LTM via n8n vector memory webhook
/n8n-ltm store <key>=<value>      — Store a memory entry via n8n webhook
/n8n-ltm hybrid <query>           — Hybrid search (LTM + recent context)
/n8n-ltm observe [session_id]     — Report session metrics to observability
/n8n-ltm guard <action>           — Check action against guardrails
/n8n-ltm status                   — Check n8n health + LTM status
```

## Examples

```text
/n8n-ltm search "excavator activity patterns"
/n8n-ltm store "deployment_fix=Use docker exec psql for migrations"
/n8n-ltm hybrid "RLS policy"
/n8n-ltm observe sess_001
/n8n-ltm guard "git push --force"
/n8n-ltm status
```

## Notes

- Requires n8n to be running (port 5678)
- Uses webhook endpoints: vector-memory, hybrid-memory, observability, guardrails
- Falls back to direct LTM python3 calls if n8n is unavailable
