---
title: External Tools Integration
created: 2026-05-15
updated: 2026-05-15
type: concept
tags: [integration, system, application, concept]
sources: [raw/codebase/external-tools.md]
confidence: high
---

# External Tools Integration

The portal embeds external workflow automation and AI tools via iframe cards, with a health check API for availability monitoring.

## Configured Tools

Tools are defined in `apps/portal/lib/tools.ts` as the `EXTERNAL_TOOLS` array:

| Tool    | Default URL             | Description                                 |
| ------- | ----------------------- | ------------------------------------------- |
| n8n     | `http://localhost:5678` | Workflow automation with 400+ integrations  |
| Flowise | `http://localhost:3000` | Visual AI workflow builder (LangChain)      |
| Svix    | Dashboard API           | Webhook service for reliable event delivery |

Environment overrides:

- `N8N_URL` — Override n8n endpoint
- `FLOWISE_URL` — Override Flowise endpoint
- `SVIX_API_KEY` — Svix dashboard API key for webhook management

## ToolCard Component

`ToolCard` renders each external tool as an embedded iframe card:

- Displays tool name, description, and icon
- Color-coded by tool type
- Lazy-loads iframe on interaction
- Shows offline badge when health check fails

## Health Check API

`GET /api/tools/status` performs HEAD health checks against each tool with a 3-second timeout.

Response format:

```json
{
  "n8n": { "status": "online", "responseTime": 120 },
  "flowise": { "status": "offline", "responseTime": null }
}
```

Status values: `online` | `offline` | `unknown`

The client polls this endpoint every 30 seconds to update tool availability badges.

## Univer Spreadsheet

The `UniverSheet` component embeds a full spreadsheet editor using `@univerjs/preset-sheets-core`.

Key points:

- Uses `createUniver()` + `useEffect` pattern
- CSS imported once inside the component (`UniverSheet.tsx`)
- Do NOT import Univer CSS in `layout.tsx` — global CSS ordering issues
- Supports Excel-like formulas, formatting, and data entry
- Used in the department tools page for operational calculations

## Svix Webhook Service

Svix provides reliable webhook delivery for the Arch-Systems platform, enabling real-time event notifications to external systems.

### Improvements Provided

**Reliable Event Delivery**

- Automatic retry logic with exponential backoff for failed webhook deliveries
- Idempotent event processing to prevent duplicate notifications
- Event queuing and guaranteed delivery ordering
- Built-in monitoring and delivery status tracking

**Security & Compliance**

- HMAC signature verification for webhook authenticity
- TLS encryption for all webhook transmissions
- IP whitelisting support for enhanced security
- Audit logging of all webhook delivery attempts

**Operational Benefits**

- Real-time notifications for critical operational events (equipment breakdowns, safety incidents, production alerts)
- Integration with external monitoring systems (Sentry, PagerDuty, custom dashboards)
- Event replay capabilities for missed notifications
- Rate limiting and throttling to prevent downstream system overload

**Use Cases in Arch-Systems**

- **Safety Incidents**: Immediate alerts to safety officers and management when incidents are logged
- **Equipment Breakdowns**: Notify engineering teams when breakdowns are reported in the engineering department
- **Production Milestones**: Real-time production metric updates to external reporting systems
- **Daily Log Changes**: Notify supervisors when daily logs are modified or submitted
- **Compliance Events**: Automated alerts for regulatory compliance thresholds

### Integration Pattern

Svix uses the dashboard API key configured via `SVIX_API_KEY` in the environment. Webhooks are created per event type, allowing targeted delivery to different endpoints based on department and event severity.

## Tools Page

Located at `(departments)/[department]/tools/page.tsx`.

Renders:

1. External tool cards (n8n, Flowise) with health status
2. Univer spreadsheet component
3. Productivity tools (tasks, documents, schedule, calculations, notes)

The tools page is shared across all departments but may show department-specific context.

## Adding a New Tool

To add a new embedded tool:

1. Add an entry to `EXTERNAL_TOOLS` in `apps/portal/lib/tools.ts`
2. The `ToolCard` component and `/api/tools/status` route pick it up automatically
3. Optionally add a specialized component in `features/departments/components/tools/`

## Security Considerations

- External tools run in iframes with sandboxing
- Health check API only exposes status and response time, no internal data
- Tool URLs are configured via environment variables, not hardcoded
- No authentication tokens are passed to external tools through the iframe

Related pages: [[portal-app-architecture]], [[ai-service]]
