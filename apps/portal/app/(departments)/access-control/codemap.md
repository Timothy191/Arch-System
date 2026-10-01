# Access Control Department (Access & Security)

## Responsibility

Manages all physical access telemetry, badge lifecycles, and life-safety accounting across the Arch-System mining site. Serves as the central nervous system for Gate Booms, Turnstiles, Contractor Inductions, and Emergency Evacuation Muster Rolls.

## Design

- **Zero-Waterfall Actions**: Interactivity relies on React 19 Server Actions (`actions.ts`) triggering fire-and-forget Redis background workflows via `triggerTrackedWorkflow()`.
- **Offline-First Tolerance**: Pit WiFi drops are mitigated by `useOfflineMuster.ts` which synchronizes the live headcount to `localStorage` (IndexedDB fallback), guaranteeing that Security never loses the "Souls on Site" baseline during a severe storm.
- **Hardware RPCs**: Boom gates and turnstiles are manipulated directly via `triggerGatePulse` which interfaces securely with physical edge relays on the local pit LAN.

## Flow

1. **Access Scan**: An RFID scan occurs at a physical gate.
2. **Ledger Insertion**: The scan is ingested and logged via `access_logs`.
3. **Strike Policy Enforcement (`logGateDenial`)**: If a scan is denied 3 times in a row, the `is_active` flag is immediately stripped from the badge and a SOC Auto-Blacklisting webhook is pushed to `n8n`.
4. **Optical Backup (`api/webhooks/tailgate`)**: If the boom breaks without an RFID scan, the optical sensor hits the Tailgate Webhook, triggering an immediate security escalation.

## Integration (Webhooks & Crons)

- `api/webhooks/tailgate`: Receives optical sensor triggers and invokes `/webhook/soc-tailgate-alert`.
- `api/cron/contractor-expiry`: Vercel Cron endpoint (Daily). Triggers `/webhook/contractor-expiry-check` to blast 48-hour warnings to supervisors for expiring contractor credentials.
