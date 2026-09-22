# SCADA Offline Runbook

## Symptoms

- Control Room displays "Offline" or "Degraded" badges.
- `cr_scada_probe_total{state="offline"}` spikes.
- Alert: `ControlRoomScadaOffline` fires.

## Impact

- Operators lose real-time machine telemetry.
- Fallback Redis cache serves stale data until TTL expires.
- Outbox will buffer control writes (start/stop) to machines.

## Diagnosis

1. Check FUXA host reachability: `curl -I https://scada.<domain>`
2. Check internal VPN or network gateway to OT (Operational Tech) VLAN.
3. Review FUXA logs for crashes: `kubectl logs deploy/fuxa -n scada`

## Mitigation

- If OT network is partitioned, switch to cellular backup VPN.
- If FUXA service is crash-looping, rollback deployment or scale replicas.

## Escalation

- OT Networking Team
- FUXA Platform Support
