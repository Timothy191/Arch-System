# Arch-System Background Orchestration & Webhooks

## 1. Engineering (Fleet & Work Orders)

- **ERP Work Orders**: Triggered during `createBreakdown` to sync the defect into the primary ERP system via `/webhook/erp-work-order`.
- **Preventative Maintenance Cron** (`api/cron/preventative-maintenance`): Daily Vercel Cron. Sweeps the fleet SMU (Service Meter Units) ledger against manufacturer schedules (250hr/500hr) via `/webhook/pm-smu-sweep`.

## 2. Access Control (Security & Identity)

- **SOC Auto-Blacklisting**: Triggered inside `logGateDenial` upon 3 sequential failed badge scans. Revokes badge and triggers `/webhook/soc-alert-blacklist`.
- **Optical Tailgating** (`api/webhooks/tailgate`): Ingests raw optical boundary breaks and invokes `/webhook/soc-tailgate-alert`.
- **Contractor Expiry Sweep** (`api/cron/contractor-expiry`): Daily cron sweeping for credentials expiring within 48 hours, invoking `/webhook/contractor-expiry-check`.

## 3. Telemetry (Sensors & Machinery)

- **Tire Predictive Requisition** (`api/telemetry/tire-wear`): High TKPH levels trigger automated CAPEX requisition drafts via `/webhook/tire-requisition`.
- **Offline Bulk Sync Ingest** (`api/telemetry/bulk-sync`): Accommodates machines reconnecting after deep-pit signal drops, chunking up to 500 points per burst into `/webhook/telemetry-bulk-ingest`.

## 4. Control Room (Operations & Shift Closeout)

- **Red Code Emergency Muster** (`api/weather`): Severe lightning strikes (<= 5km) trigger a site-wide evacuation via `/webhook/emergency-muster`.
- **AI Shift Handoff Generation** (`api/cron/shift-handoff`): Cron jobs firing at 05:45 and 17:45 to auto-compile the shift's delays, breakdowns, and scada logs into an AI-synthesized handover summary via `/webhook/shift-handoff-generation`.
