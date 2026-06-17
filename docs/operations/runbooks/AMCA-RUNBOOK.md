# AMCA Production Runbook

## Architecture Overview

AMCA consists of:

- `cache-agent` (L1 Memory / L0 Disk)
- `L2 Redis Cluster`
- `telemetry` (Collector & Processor)
- `policy-engine` (Intelligence & Healing)

## Common Operations

### 1. Rebuilding a Corrupt Namespace

If tags become corrupt or stale data persists:

```bash
curl -X POST http://policy-engine.internal/api/heal/flush -d '{"tags": ["corrupted-tag"]}'
```

### 2. Manual Rollback

```bash
./ci/scripts/rollback.sh
```

### 3. Scaling

HPA automatically handles CPU spikes. To force scale L1 nodes:

```bash
kubectl scale deployment cache-agent --replicas=10
```

## Troubleshooting

- **Miss Rate Spikes**: Check `Grafana Cache Dashboard`. If a specific key dominates, verify the Policy Engine is outputting rules for it.
- **Out of Memory**: Check if L1 TTLs are too long or Memory LRU isn't evicting fast enough.
