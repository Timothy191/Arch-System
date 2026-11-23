'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  BellRing,
  CheckCircle2,
  Database,
  ExternalLink,
  ShieldCheck,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type CriticalityLevel = 'CRITICAL' | 'HIGH';
type TriggerKind = 'Webhook POST' | 'Supabase CDC' | 'Cron Schedule';

interface RegisteredWebhookSummary {
  readonly id: string;
  readonly url: string;
  readonly description?: string | null;
  readonly event_types: readonly string[];
  readonly active: boolean;
}

interface FlowNode {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly kind: 'trigger' | 'guard' | 'transform' | 'action';
  readonly x: number;
  readonly y: number;
  readonly detail: string;
}

interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

interface CriticalWorkflowSpec {
  readonly id: string;
  readonly name: string;
  readonly criticality: CriticalityLevel;
  readonly triggerKind: TriggerKind;
  readonly webhookPath: string;
  readonly eventTypes: readonly string[];
  readonly scheduleOrEvent: string;
  readonly description: string;
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
}

const NODE_WIDTH = 172;
const NODE_HEIGHT = 68;

const CRITICAL_WORKFLOWS: readonly CriticalWorkflowSpec[] = [
  {
    id: 'shift-closeout-sync',
    name: 'Shift Closeout & Handover Pipeline',
    criticality: 'CRITICAL',
    triggerKind: 'Webhook POST',
    webhookPath: '/api/webhooks (daily_log.*)',
    eventTypes: ['daily_log.created', 'daily_log.updated'],
    scheduleOrEvent: 'On close_shift RPC + 06:00 / 18:00 SAST',
    description:
      'Locks shift tonnage, invalidates Redis L1/L2 department tags, and dispatches executive PDF & WhatsApp handover summaries.',
    nodes: [
      {
        id: 't1',
        title: 'Shift Closeout Hook',
        subtitle: 'POST /shift-closeout',
        kind: 'trigger',
        x: 24,
        y: 108,
        detail: 'Triggered by Control Room close_shift Server Action with x-arch-signature.',
      },
      {
        id: 'g1',
        title: 'HMAC & RBAC Guard',
        subtitle: 'Verify Secret + Role',
        kind: 'guard',
        x: 242,
        y: 108,
        detail: 'Validates HMAC-SHA256 webhook signature and operator shift authorization.',
      },
      {
        id: 'tr1',
        title: 'Reconcile Tonnage',
        subtitle: 'Supabase + Redis Tags',
        kind: 'transform',
        x: 460,
        y: 108,
        detail: 'Aggregates coal/waste tonnes, updates cache tags, and builds handover payload.',
      },
      {
        id: 'a1',
        title: 'PDF & Executive Hub',
        subtitle: 'Generate Shift Report',
        kind: 'action',
        x: 678,
        y: 42,
        detail: 'Archives signed PDF report and refreshes /hub executive KPIs.',
      },
      {
        id: 'a2',
        title: 'WhatsApp & Email',
        subtitle: 'Notify Mine Managers',
        kind: 'action',
        x: 678,
        y: 174,
        detail: 'Sends shift summary via n8n Twilio/SMTP connector with retry backoff.',
      },
    ],
    edges: [
      { from: 't1', to: 'g1', label: 'signed' },
      { from: 'g1', to: 'tr1', label: 'valid' },
      { from: 'tr1', to: 'a1', label: 'archive' },
      { from: 'tr1', to: 'a2', label: 'dispatch' },
    ],
  },
  {
    id: 'scada-anomaly-alert',
    name: 'SCADA Telemetry Anomaly Escalation',
    criticality: 'CRITICAL',
    triggerKind: 'Supabase CDC',
    webhookPath: '/api/webhooks (breakdown.*)',
    eventTypes: ['breakdown.created', 'breakdown.updated'],
    scheduleOrEvent: 'Realtime CDC: scada_telemetry',
    description:
      'Detects crusher amperage spikes, belt trips, or abnormal vibration via TelemetryAnomalyEngine and escalates to Control Room.',
    nodes: [
      {
        id: 't2',
        title: 'SCADA CDC Stream',
        subtitle: 'scada_telemetry INSERT',
        kind: 'trigger',
        x: 24,
        y: 108,
        detail: 'Fires when TelemetryAnomalyEngine flags Z-score > 3.0 or trip state.',
      },
      {
        id: 'g2',
        title: 'Dedup & Throttle',
        subtitle: 'Redis 5m Window',
        kind: 'guard',
        x: 242,
        y: 108,
        detail: 'Prevents alert storms using Redis sliding window per asset_id.',
      },
      {
        id: 'tr2',
        title: 'Enrich Asset Context',
        subtitle: 'FMEA RPN + Operator',
        kind: 'transform',
        x: 460,
        y: 108,
        detail: 'Attaches equipment history, pit block, and active shift supervisor.',
      },
      {
        id: 'a3',
        title: 'Control Room Alert',
        subtitle: 'Broadcast + Audit Log',
        kind: 'action',
        x: 678,
        y: 42,
        detail: 'Pushes critical banner to Control Room & logs immutable audit event.',
      },
      {
        id: 'a4',
        title: 'Engineering Ticket',
        subtitle: 'Create Work Order',
        kind: 'action',
        x: 678,
        y: 174,
        detail: 'Opens priority inspection task in Engineering queue.',
      },
    ],
    edges: [
      { from: 't2', to: 'g2' },
      { from: 'g2', to: 'tr2' },
      { from: 'tr2', to: 'a3' },
      { from: 'tr2', to: 'a4' },
    ],
  },
  {
    id: 'plant-downtime-escalation',
    name: 'Unplanned Plant Downtime Trigger',
    criticality: 'CRITICAL',
    triggerKind: 'Webhook POST',
    webhookPath: '/api/webhooks (operational_delay.*)',
    eventTypes: ['operational_delay.created', 'operational_delay.updated'],
    scheduleOrEvent: 'Delay > 15 min threshold',
    description:
      'Escalates unplanned processing plant stoppages exceeding 15 minutes to Engineering and Plant Management.',
    nodes: [
      {
        id: 't3',
        title: 'Plant Delay Event',
        subtitle: 'POST /plant-downtime',
        kind: 'trigger',
        x: 24,
        y: 108,
        detail: 'Emitted when plant_delays duration crosses 15-minute SLA.',
      },
      {
        id: 'g3',
        title: 'Classify Severity',
        subtitle: 'Production vs Mech',
        kind: 'guard',
        x: 242,
        y: 108,
        detail: 'Routes mechanical/electrical faults separately from planned maintenance.',
      },
      {
        id: 'tr3',
        title: 'Compute Tonnage Loss',
        subtitle: 'Feed Rate × Minutes',
        kind: 'transform',
        x: 460,
        y: 108,
        detail: 'Estimates lost ROM feed tonnage against shift target.',
      },
      {
        id: 'a5',
        title: 'Escalate to On-Call',
        subtitle: 'n8n Pager / Slack',
        kind: 'action',
        x: 678,
        y: 108,
        detail: 'Notifies Plant Superintendent and Maintenance Lead.',
      },
    ],
    edges: [
      { from: 't3', to: 'g3' },
      { from: 'g3', to: 'tr3' },
      { from: 'tr3', to: 'a5' },
    ],
  },
  {
    id: 'fleet-maintenance-trigger',
    name: 'Fleet & Drill Rig Maintenance Trigger',
    criticality: 'HIGH',
    triggerKind: 'Cron Schedule',
    webhookPath: '/api/webhooks (breakdown.completed)',
    eventTypes: ['breakdown.created', 'breakdown.completed'],
    scheduleOrEvent: 'Every 30 min • Engine Hours',
    description:
      'Monitors drill rig & haul truck engine hours and PredictiveMaintenanceEngine scores to schedule service intervals.',
    nodes: [
      {
        id: 't4',
        title: '30m Fleet Poller',
        subtitle: 'Cron */30 * * * *',
        kind: 'trigger',
        x: 24,
        y: 108,
        detail: 'Evaluates fleet engine hours and oil/vibration thresholds.',
      },
      {
        id: 'g4',
        title: 'Threshold Filter',
        subtitle: 'Remaining <= 25h',
        kind: 'guard',
        x: 242,
        y: 108,
        detail: 'Filters machines approaching 250h / 500h service interval.',
      },
      {
        id: 'tr4',
        title: 'Build Service Pack',
        subtitle: 'Parts & Bay Assign',
        kind: 'transform',
        x: 460,
        y: 108,
        detail: 'Prepares maintenance checklist and workshop slot.',
      },
      {
        id: 'a6',
        title: 'Sync Engineering',
        subtitle: 'Update Fleet Status',
        kind: 'action',
        x: 678,
        y: 108,
        detail: 'Queues maintenance work order and flags asset on availability board.',
      },
    ],
    edges: [
      { from: 't4', to: 'g4' },
      { from: 'g4', to: 'tr4' },
      { from: 'tr4', to: 'a6' },
    ],
  },
  {
    id: 'safety-access-violation',
    name: 'Access Control & Safety Gate Alert',
    criticality: 'CRITICAL',
    triggerKind: 'Supabase CDC',
    webhookPath: '/api/webhooks (daily_log.created)',
    eventTypes: ['daily_log.created'],
    scheduleOrEvent: 'Realtime CDC: access_logs',
    description:
      'Immediately flags expired permits, failed breathalyzer checks, or unauthorized zone entry to Security & HSE.',
    nodes: [
      {
        id: 't5',
        title: 'Gate Event CDC',
        subtitle: 'access_logs DENIED',
        kind: 'trigger',
        x: 24,
        y: 108,
        detail: 'Captures denied gate scans or safety interlock violations.',
      },
      {
        id: 'g5',
        title: 'HSE Policy Check',
        subtitle: 'Zone & Permit Rules',
        kind: 'guard',
        x: 242,
        y: 108,
        detail: 'Verifies whether violation is high-risk pit or blasting zone.',
      },
      {
        id: 'a7',
        title: 'Security & HSE Hook',
        subtitle: 'Immediate Dispatch',
        kind: 'action',
        x: 460,
        y: 108,
        detail: 'Dispatches incident alert to Access Control & HSE Compliance.',
      },
    ],
    edges: [
      { from: 't5', to: 'g5' },
      { from: 'g5', to: 'a7' },
    ],
  },
  {
    id: 'daily-production-digest',
    name: 'Daily Production & Diesel Reconciliation',
    criticality: 'HIGH',
    triggerKind: 'Cron Schedule',
    webhookPath: '/api/webhooks (production_log.*)',
    eventTypes: ['production_log.created', 'production_log.updated'],
    scheduleOrEvent: 'Daily 06:30 SAST',
    description:
      'Compiles 24h ROM coal, waste stripping, drill meters, and diesel burn into an executive digest.',
    nodes: [
      {
        id: 't6',
        title: '06:30 SAST Cron',
        subtitle: 'Daily Reconciliation',
        kind: 'trigger',
        x: 24,
        y: 108,
        detail: 'Starts after night shift closeout window.',
      },
      {
        id: 'tr6',
        title: 'Aggregate KPIs',
        subtitle: 'Tonnage + Diesel + Yield',
        kind: 'transform',
        x: 242,
        y: 108,
        detail: 'Queries Supabase materialized views across all active pits.',
      },
      {
        id: 'a8',
        title: 'Executive Digest',
        subtitle: 'Hub + Email PDF',
        kind: 'action',
        x: 460,
        y: 108,
        detail: 'Publishes daily scorecard to Executive Hub & stakeholders.',
      },
    ],
    edges: [
      { from: 't6', to: 'tr6' },
      { from: 'tr6', to: 'a8' },
    ],
  },
];

const NODE_KIND_STYLES: Readonly<
  Record<FlowNode['kind'], { border: string; badge: string; label: string }>
> = {
  trigger: {
    border: 'border-indigo-300 bg-indigo-50/90',
    badge: 'bg-indigo-600 text-white',
    label: 'TRIGGER',
  },
  guard: {
    border: 'border-amber-300 bg-amber-50/90',
    badge: 'bg-amber-600 text-white',
    label: 'GUARD',
  },
  transform: {
    border: 'border-sky-300 bg-sky-50/90',
    badge: 'bg-sky-600 text-white',
    label: 'TRANSFORM',
  },
  action: {
    border: 'border-emerald-300 bg-emerald-50/90',
    badge: 'bg-emerald-600 text-white',
    label: 'ACTION',
  },
};

function renderNodeIcon(kind: FlowNode['kind']) {
  if (kind === 'trigger') return <Webhook className="h-3.5 w-3.5 text-indigo-600" />;
  if (kind === 'guard') return <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />;
  if (kind === 'transform') return <Database className="h-3.5 w-3.5 text-sky-600" />;
  return <BellRing className="h-3.5 w-3.5 text-emerald-600" />;
}

export function CriticalWorkflowsCanvas() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(
    CRITICAL_WORKFLOWS[0]?.id ?? 'shift-closeout-sync'
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [registeredWebhooks, setRegisteredWebhooks] = useState<readonly RegisteredWebhookSummary[]>(
    []
  );
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [provisionFeedback, setProvisionFeedback] = useState<string | null>(null);

  const loadRegisteredWebhooks = useCallback(async () => {
    try {
      const response = await fetch('/api/webhooks', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = (await response.json()) as { webhooks?: RegisteredWebhookSummary[] };
      if (Array.isArray(payload.webhooks)) {
        setRegisteredWebhooks(payload.webhooks);
      }
    } catch {
      // Keep blueprint view functional when offline or unauthenticated
    }
  }, []);

  useEffect(() => {
    void loadRegisteredWebhooks();
  }, [loadRegisteredWebhooks]);

  const isWorkflowConfigured = (wf: CriticalWorkflowSpec): boolean =>
    registeredWebhooks.some(
      (wh) => wh.active && wf.eventTypes.some((eventType) => wh.event_types?.includes(eventType))
    );

  const handleProvisionWorkflow = async (wf: CriticalWorkflowSpec) => {
    setProvisioningId(wf.id);
    setProvisionFeedback(null);
    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `https://n8n.arch-system.internal/webhook/${wf.id}`,
          description: `${wf.name} (${wf.criticality})`,
          event_types: wf.eventTypes,
        }),
      });
      if (response.ok) {
        await loadRegisteredWebhooks();
        setProvisionFeedback(`Configured webhook trigger for "${wf.name}".`);
      } else {
        setProvisionFeedback(`Open Admin -> Webhooks to set a custom target URL for "${wf.name}".`);
      }
    } catch {
      setProvisionFeedback(`Open Admin -> Webhooks to set a custom target URL for "${wf.name}".`);
    } finally {
      setProvisioningId(null);
    }
  };

  const activeWorkflow =
    CRITICAL_WORKFLOWS.find((wf) => wf.id === selectedWorkflowId) ?? CRITICAL_WORKFLOWS[0];
  if (!activeWorkflow) return null;

  const activeNode =
    activeWorkflow.nodes.find((n) => n.id === selectedNodeId) ?? activeWorkflow.nodes[0];
  const isActiveConfigured = isWorkflowConfigured(activeWorkflow);

  const maxNodeX = Math.max(...activeWorkflow.nodes.map((n) => n.x + NODE_WIDTH)) + 32;
  const maxNodeY = Math.max(...activeWorkflow.nodes.map((n) => n.y + NODE_HEIGHT)) + 36;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12" data-testid="critical-workflows-panel">
      {/* Left column: Critical Webhooks & Workflow Triggers */}
      <GlassCard variant="spotlight" className="flex flex-col p-4 lg:col-span-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="font-semibold text-sm text-zinc-900">
              Critical Webhooks &amp; Workflows
            </h2>
          </div>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-mono font-semibold text-[11px] text-indigo-700">
            {CRITICAL_WORKFLOWS.length} flows
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {CRITICAL_WORKFLOWS.map((wf) => {
            const isSelected = wf.id === activeWorkflow.id;
            const configured = isWorkflowConfigured(wf);
            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => {
                  setSelectedWorkflowId(wf.id);
                  setSelectedNodeId(wf.nodes[0]?.id ?? null);
                }}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-indigo-300 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-200'
                    : 'border-zinc-200 bg-white/80 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-zinc-900">{wf.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono font-semibold text-[10px] ${
                        configured ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {configured ? 'ACTIVE' : 'READY'}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono font-semibold text-[10px] ${
                        wf.criticality === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {wf.criticality}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-500">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                    {wf.triggerKind}
                  </span>
                  <span className="truncate">{wf.webhookPath}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-zinc-200/70 border-t pt-3">
          <span className="font-mono text-[11px] text-zinc-500">Managed via n8n + Admin</span>
          <Link
            href="/admin?tab=webhooks"
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 text-xs hover:text-indigo-800"
          >
            Edit Endpoints
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </GlassCard>

      {/* Right column: n8n Flow Visual (Rectangle Boxes + Connecting Lines) */}
      <GlassCard variant="window" className="flex flex-col p-4 lg:col-span-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-zinc-200/70 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Workflow className="h-4.5 w-4.5 text-purple-600" />
              <h3 className="font-semibold text-sm text-zinc-900">{activeWorkflow.name}</h3>
            </div>
            <p className="mt-0.5 text-xs text-zinc-600">{activeWorkflow.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ${
                isActiveConfigured
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                  : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700'
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              {isActiveConfigured ? 'Webhook Active' : 'n8n Blueprint'}
            </span>
            {!isActiveConfigured && (
              <button
                type="button"
                disabled={provisioningId === activeWorkflow.id}
                onClick={() => {
                  void handleProvisionWorkflow(activeWorkflow);
                }}
                className="rounded-md border border-indigo-300 bg-indigo-600 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {provisioningId === activeWorkflow.id ? 'Provisioning...' : 'Provision Trigger'}
              </button>
            )}
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-700">
              {activeWorkflow.scheduleOrEvent}
            </span>
          </div>
        </div>
        {provisionFeedback && (
          <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 font-mono text-indigo-800 text-xs">
            {provisionFeedback}
          </div>
        )}

        {/* Interactive n8n Node Graph Canvas */}
        <div
          className="relative overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50/70 p-3"
          style={{
            backgroundImage: 'radial-gradient(rgba(113,113,122,0.18) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <div className="relative" style={{ width: `${maxNodeX}px`, height: `${maxNodeY}px` }}>
            {/* SVG Connecting Lines with Arrows */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${maxNodeX} ${maxNodeY}`}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="n8n-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                </marker>
              </defs>
              {activeWorkflow.edges.map((edge) => {
                const fromNode = activeWorkflow.nodes.find((n) => n.id === edge.from);
                const toNode = activeWorkflow.nodes.find((n) => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                const x1 = fromNode.x + NODE_WIDTH;
                const y1 = fromNode.y + NODE_HEIGHT / 2;
                const x2 = toNode.x;
                const y2 = toNode.y + NODE_HEIGHT / 2;
                const midX = (x1 + x2) / 2;
                const pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth={2}
                      strokeOpacity={0.65}
                      markerEnd="url(#n8n-arrow)"
                    />
                    {edge.label && (
                      <text
                        x={midX}
                        y={(y1 + y2) / 2 - 6}
                        textAnchor="middle"
                        className="fill-zinc-500 font-mono text-[9px]"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Rectangle Node Boxes */}
            {activeWorkflow.nodes.map((node) => {
              const style = NODE_KIND_STYLES[node.kind];
              const isNodeSelected = activeNode?.id === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                  }}
                  className={`absolute flex flex-col justify-between rounded-lg border-2 p-2.5 text-left shadow-xs transition-all ${style.border} ${
                    isNodeSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 font-semibold text-[11px] text-zinc-900">
                      {renderNodeIcon(node.kind)}
                      <span className="truncate">{node.title}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-mono text-[10px] text-zinc-600">
                      {node.subtitle}
                    </span>
                    <span className={`rounded px-1 py-0.2 font-mono text-[8px] ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Node Details Bar */}
        {activeNode && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/75 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2.5">
              {renderNodeIcon(activeNode.kind)}
              <div>
                <span className="font-semibold text-zinc-900">{activeNode.title}: </span>
                <span className="text-zinc-600">{activeNode.detail}</span>
              </div>
            </div>
            <span className="font-mono text-[11px] text-indigo-700">
              {activeWorkflow.webhookPath}
            </span>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
