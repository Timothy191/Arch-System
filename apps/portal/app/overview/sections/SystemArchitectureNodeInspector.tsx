'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';
import {
  Activity,
  Bot,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  GitCommit,
  Globe,
  HardDrive,
  Layers,
  Lock,
  Network,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  type ArchCanvasEdge,
  type ArchCanvasNode,
  CANVAS_NODES,
} from './system-architecture-nodes-data';

export function NodeIcon({
  name,
  className,
}: {
  name: ArchCanvasNode['iconName'];
  className?: string;
}) {
  switch (name) {
    case 'lock':
      return <Lock className={className} />;
    case 'radio':
      return <Radio className={className} />;
    case 'printer':
      return <Printer className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'building':
      return <Building2 className={className} />;
    case 'activity':
      return <Activity className={className} />;
    case 'qrcode':
      return <QrCode className={className} />;
    case 'database':
      return <Database className={className} />;
    case 'server':
      return <Server className={className} />;
    case 'shield':
      return <ShieldCheck className={className} />;
    case 'cpu':
      return <Cpu className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'refresh':
      return <RefreshCw className={className} />;
    case 'harddrive':
      return <HardDrive className={className} />;
    case 'bot':
      return <Bot className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
  }
}

export function SystemArchitectureNodeInspector({
  selectedNode,
  connectedEdges,
  onSelectNode,
}: {
  selectedNode: ArchCanvasNode;
  connectedEdges: ArchCanvasEdge[];
  onSelectNode: (id: string) => void;
}) {
  return (
    <div
      data-testid="n8n-node-inspector"
      className="grid grid-cols-1 items-start gap-5 border-border-subtle border-t bg-white p-5 lg:grid-cols-12"
    >
      <div className="space-y-2 lg:col-span-5">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 font-bold font-mono text-[10px] uppercase"
            style={{
              backgroundColor: `${selectedNode.color}18`,
              color: selectedNode.color,
            }}
          >
            {selectedNode.typeLabel}
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {selectedNode.protocol}
          </Badge>
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 font-mono text-[10px] text-emerald-700"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {selectedNode.metricBadge}
          </Badge>
        </div>

        <h4 className="flex items-center gap-2 font-bold text-base text-text-heading">
          {selectedNode.title}
          <span className="font-normal text-text-secondary text-xs">— {selectedNode.subtitle}</span>
        </h4>

        <p className="text-text-secondary text-xs leading-relaxed">{selectedNode.description}</p>

        <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-accent-blue">
          <GitCommit className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Source SSoT: {selectedNode.filePath}</span>
        </div>
      </div>

      {/* Inputs & Outputs Ports */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-4">
        <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono font-semibold text-[10px] text-text-muted uppercase tracking-wider">
            <Layers className="h-3 w-3 text-accent-blue" />
            Input Signals ({selectedNode.inputs.length})
          </div>
          <ul className="space-y-1">
            {selectedNode.inputs.map((inp) => (
              <li
                key={inp}
                className="flex items-center gap-1.5 font-mono text-[11px] text-text-heading"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />
                <span>{inp}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono font-semibold text-[10px] text-text-muted uppercase tracking-wider">
            <Network className="h-3 w-3 text-accent-green" />
            Output Emissions ({selectedNode.outputs.length})
          </div>
          <ul className="space-y-1">
            {selectedNode.outputs.map((out) => (
              <li
                key={out}
                className="flex items-center gap-1.5 font-mono text-[11px] text-text-heading"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green" />
                <span>{out}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Connected Wires List */}
      <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-3 lg:col-span-3">
        <div className="mb-1.5 font-mono font-semibold text-[10px] text-text-muted uppercase tracking-wider">
          Active Wire Connections ({connectedEdges.length})
        </div>
        <div className="max-h-[115px] space-y-1.5 overflow-y-auto pr-1">
          {connectedEdges.map((edge) => {
            const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
            const otherNode = CANVAS_NODES.find((n) => n.id === otherId);
            const direction = edge.source === selectedNode.id ? '──►' : '◄──';
            return (
              <button
                key={edge.id}
                type="button"
                onClick={() => onSelectNode(otherId)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-2 rounded border border-border-subtle bg-white px-2 py-1',
                  'text-left font-mono text-[10px] transition-colors hover:border-accent-blue/50'
                )}
              >
                <span className="truncate font-medium text-text-heading">
                  {direction} {otherNode?.title ?? otherId}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[9px]"
                  style={{ backgroundColor: `${edge.color}18`, color: edge.color }}
                >
                  {edge.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
