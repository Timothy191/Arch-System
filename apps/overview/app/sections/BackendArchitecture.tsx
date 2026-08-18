"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BACKEND_SERVICES, BACKEND_CONNECTIONS, type BackendService } from "@/lib/data";
import {
  Server,
  Database,
  Layers,
  Cpu,
  Eye,
  Shield,
  Clock,
  Activity,
  CheckCircle2,
  Filter,
  Info,
  Radio,
  Workflow,
  Sparkles,
} from "lucide-react";

// Category Icons & Color Mapping
const CATEGORY_ICONS: Record<
  BackendService["category"],
  React.ComponentType<{ className?: string }>
> = {
  client: Layers,
  gateway: Workflow,
  database: Database,
  cache: Server,
  iot: Cpu,
  observability: Eye,
};

// Custom Node Component
function ServiceNode({
  data,
  selected,
}: {
  data: BackendService & { isDimmed?: boolean };
  selected?: boolean;
}) {
  const IconComponent = CATEGORY_ICONS[data.category] || Server;

  return (
    <div
      className={`w-64 rounded-xl border transition-all duration-200 shadow-xl overflow-hidden cursor-pointer ${
        selected
          ? "ring-2 ring-[#3ecf8e] border-[#3ecf8e] bg-[#222222] shadow-[0_0_20px_rgba(62,207,142,0.25)]"
          : "border-[#363636] bg-[#171717] hover:border-[#525252] hover:bg-[#1c1c1c]"
      } ${data.isDimmed ? "opacity-30 grayscale-[50%]" : "opacity-100"}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-[#363636] !border-2 !border-[#171717] transition-colors hover:!bg-[#3ecf8e]"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-2.5 !h-2.5 !bg-[#363636] !border-2 !border-[#171717] transition-colors hover:!bg-[#3ecf8e]"
      />

      {/* Header Accent Bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: data.color }} />

      {/* Node Header */}
      <div className="p-3.5 pb-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#363636]"
              style={{ backgroundColor: `${data.color}15`, color: data.color }}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#fafafa] leading-snug">{data.name}</div>
              <div className="text-[10px] text-[#898989] uppercase tracking-wider font-mono">
                {data.role}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#a1a1aa] line-clamp-2 leading-relaxed mt-1">
          {data.description}
        </p>
      </div>

      {/* Node Meta / Badges */}
      <div className="px-3.5 pb-3 pt-1 border-t border-[#262626] bg-[#141414] flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
        <div className="flex items-center gap-1 text-[#b4b4b4] font-mono">
          <Activity className="w-3 h-3 text-[#3ecf8e]" />
          <span>{data.sla.split(" ")[0]}</span>
        </div>
        <div className="flex items-center gap-1">
          {data.protocols.slice(0, 2).map((proto) => (
            <span
              key={proto}
              className="px-1.5 py-0.5 rounded bg-[#242424] text-[#a1a1aa] font-mono text-[9px] border border-[#333333]"
            >
              {proto.split(" ")[0]}
            </span>
          ))}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-[#3ecf8e] !border-2 !border-[#171717] transition-colors hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-2.5 !h-2.5 !bg-[#3ecf8e] !border-2 !border-[#171717] transition-colors hover:scale-125"
      />
    </div>
  );
}

const nodeTypes = {
  service: ServiceNode,
};

type FilterMode = "all" | "data" | "realtime" | "observability" | "cache";

export default function BackendArchitecture() {
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>("supabase-db");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Filtered Services & Connections
  const activeServiceIds = useMemo(() => {
    if (filterMode === "all") return new Set(BACKEND_SERVICES.map((s) => s.id));

    const matchingConns = BACKEND_CONNECTIONS.filter((conn) => {
      if (filterMode === "data") return conn.flowType === "data";
      if (filterMode === "realtime") return conn.flowType === "realtime" || conn.flowType === "iot";
      if (filterMode === "observability") return conn.flowType === "observability";
      if (filterMode === "cache") return conn.flowType === "cache";
      return true;
    });

    const ids = new Set<string>();
    matchingConns.forEach((c) => {
      ids.add(c.source);
      ids.add(c.target);
    });
    return ids;
  }, [filterMode]);

  // Initial Layout Calculation
  const initialNodes: Node[] = useMemo(() => {
    // 4 Columns Layout:
    // Col 0 (x: 40): Clients (portal-app, cms-app)
    // Col 1 (x: 360): API Gateway & Async (server-actions, inngest-workers)
    // Col 2 (x: 680): Core Data & Cache (supabase-db, supabase-realtime, supabase-storage, redis-cluster)
    // Col 3 (x: 1000): SCADA, IoT & AI Mesh (fuxa-scada, satellite-tiles, langfuse-mesh, telemetry-sentry)

    const positions: Record<string, { x: number; y: number }> = {
      // Column 0: Clients
      "portal-app": { x: 40, y: 120 },
      "cms-app": { x: 40, y: 380 },

      // Column 1: Gateways & Orchestration
      "server-actions": { x: 360, y: 140 },
      "inngest-workers": { x: 360, y: 360 },

      // Column 2: Data Persistence & Fast State
      "supabase-db": { x: 680, y: 40 },
      "supabase-realtime": { x: 680, y: 220 },
      "redis-cluster": { x: 680, y: 400 },
      "supabase-storage": { x: 680, y: 580 },

      // Column 3: SCADA Hardware & Observability
      "fuxa-scada": { x: 1020, y: 60 },
      "satellite-tiles": { x: 1020, y: 220 },
      "langfuse-mesh": { x: 1020, y: 380 },
      "telemetry-sentry": { x: 1020, y: 540 },
    };

    return BACKEND_SERVICES.map((svc) => {
      const pos = positions[svc.id] || { x: 100, y: 100 };
      const isDimmed = !activeServiceIds.has(svc.id);

      return {
        id: svc.id,
        type: "service",
        position: pos,
        data: {
          ...svc,
          isDimmed,
        },
        selected: svc.id === selectedServiceId,
      };
    });
  }, [activeServiceIds, selectedServiceId]);

  const initialEdges: Edge[] = useMemo(() => {
    return BACKEND_CONNECTIONS.map((conn) => {
      const isMatchingFilter =
        filterMode === "all" ||
        (filterMode === "data" && conn.flowType === "data") ||
        (filterMode === "realtime" && (conn.flowType === "realtime" || conn.flowType === "iot")) ||
        (filterMode === "observability" && conn.flowType === "observability") ||
        (filterMode === "cache" && conn.flowType === "cache");

      return {
        id: conn.id,
        source: conn.source,
        target: conn.target,
        animated: isMatchingFilter,
        label: conn.protocol,
        labelStyle: {
          fill: isMatchingFilter ? "#fafafa" : "#525252",
          fontWeight: 600,
          fontSize: 10,
          fontFamily: "monospace",
        },
        labelBgStyle: {
          fill: isMatchingFilter ? "#171717" : "#111111",
          fillOpacity: 0.9,
          stroke: isMatchingFilter ? conn.color : "#333333",
          strokeWidth: 1,
          rx: 4,
          ry: 4,
        },
        style: {
          stroke: isMatchingFilter ? conn.color : "#262626",
          strokeWidth: isMatchingFilter ? 2 : 1,
          opacity: isMatchingFilter ? 1 : 0.2,
        },
      };
    });
  }, [filterMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync selection/dimming updates when filter or selection changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedServiceId(node.id);
    setSelectedConnectionId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedConnectionId(edge.id);
    const conn = BACKEND_CONNECTIONS.find((c) => c.id === edge.id);
    if (conn) {
      setSelectedServiceId(conn.target);
    }
  }, []);

  const activeService = useMemo(() => {
    return BACKEND_SERVICES.find((s) => s.id === selectedServiceId) || BACKEND_SERVICES[0];
  }, [selectedServiceId]);

  const activeConnection = useMemo(() => {
    return BACKEND_CONNECTIONS.find((c) => c.id === selectedConnectionId);
  }, [selectedConnectionId]);

  const relatedConnections = useMemo(() => {
    if (!activeService) return [];
    return BACKEND_CONNECTIONS.filter(
      (c) => c.source === activeService.id || c.target === activeService.id,
    );
  }, [activeService]);

  return (
    <div className="space-y-6">
      {/* View Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#171717] border border-[#363636] p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-[#fafafa] flex items-center gap-2">
              <Server className="w-5 h-5 text-[#3ecf8e]" />
              Backend Connections & Data Topology
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[#3ecf8e]/10 text-[#3ecf8e] text-xs font-mono font-medium border border-[#3ecf8e]/20">
              Active Mesh
            </span>
          </div>
          <p className="text-xs text-[#898989] mt-1">
            Real-time visual map of database connections, caching layers, SCADA IoT streams, and AI
            telemetry
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center flex-wrap gap-1.5 bg-[#0f0f0f] border border-[#2e2e2e] p-1 rounded-lg">
          <span className="text-[11px] text-[#71717a] font-medium px-2 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Flow:
          </span>
          {(
            [
              { id: "all", label: "All Mesh", icon: Sparkles },
              { id: "data", label: "Core Data", icon: Database },
              { id: "cache", label: "Fast Cache", icon: Server },
              { id: "realtime", label: "SCADA & Realtime", icon: Radio },
              { id: "observability", label: "AI & OTel", icon: Eye },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = filterMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setFilterMode(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#242424] text-[#3ecf8e] border border-[#3ecf8e]/30 shadow-sm"
                    : "text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#1a1a1a]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Diagram & Detail Inspector Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* React Flow Interactive Canvas */}
        <div className="xl:col-span-8 bg-[#121212] border border-[#2a2a2a] rounded-2xl h-[720px] relative overflow-hidden shadow-2xl">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            attributionPosition="bottom-left"
            minZoom={0.25}
            maxZoom={1.5}
          >
            <Background color="#2a2a2a" gap={20} size={1.2} />
            <Controls className="!bg-[#171717] !border-[#363636] !fill-[#fafafa] !rounded-lg" />
            <MiniMap
              className="!bg-[#171717] !border-[#363636] !rounded-lg"
              nodeColor={(node) => {
                const svc = BACKEND_SERVICES.find((s) => s.id === node.id);
                return svc?.color || "#3ecf8e";
              }}
              maskColor="rgba(15, 15, 15, 0.75)"
            />
          </ReactFlow>

          {/* Quick Legend Overlay */}
          <div className="absolute top-4 left-4 bg-[#171717]/90 backdrop-blur-md border border-[#363636] rounded-xl p-3.5 text-xs shadow-lg max-w-xs">
            <div className="font-semibold text-[#fafafa] mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#3ecf8e]" />
              Topology Layers
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#b4b4b4]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#3ecf8e]" />
                <span>Primary DB</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#3b82f6]" />
                <span>Gateway RPC</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#ef4444]" />
                <span>Redis Locks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#06b6d4]" />
                <span>SCADA / IoT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#f59e0b]" />
                <span>Inngest Batch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#ec4899]" />
                <span>Langfuse AI</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 bg-[#171717]/80 backdrop-blur-sm border border-[#363636] rounded-lg px-3 py-1.5 text-[11px] text-[#898989] font-mono">
            Click node or edge for specs • Pan & Zoom enabled
          </div>
        </div>

        {/* Selected Service Detail Drawer / Inspector */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Active Node Detail Card */}
          <div className="bg-[#171717] border border-[#363636] rounded-2xl p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#363636] shadow-md"
                  style={{
                    backgroundColor: `${activeService.color}15`,
                    color: activeService.color,
                  }}
                >
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#fafafa]">{activeService.name}</h3>
                  <p className="text-xs text-[#898989] font-mono">{activeService.tech}</p>
                </div>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium capitalize"
                style={{
                  backgroundColor: `${activeService.color}20`,
                  color: activeService.color,
                }}
              >
                {activeService.category}
              </span>
            </div>

            {/* Description */}
            <div className="py-4 border-b border-[#2a2a2a]">
              <div className="text-xs text-[#71717a] uppercase tracking-wider font-semibold mb-1">
                Overview
              </div>
              <p className="text-xs text-[#d4d4d8] leading-relaxed">{activeService.description}</p>
            </div>

            {/* SLA & Security Grid */}
            <div className="grid grid-cols-2 gap-3 py-4 border-b border-[#2a2a2a]">
              <div className="bg-[#121212] border border-[#262626] p-2.5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[#898989] text-[11px] mb-1">
                  <Clock className="w-3.5 h-3.5 text-[#3ecf8e]" />
                  <span>Latency Target</span>
                </div>
                <div className="text-xs font-mono font-semibold text-[#fafafa]">
                  {activeService.sla}
                </div>
              </div>

              <div className="bg-[#121212] border border-[#262626] p-2.5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[#898989] text-[11px] mb-1">
                  <Shield className="w-3.5 h-3.5 text-[#3b82f6]" />
                  <span>Security & Auth</span>
                </div>
                <div className="text-xs font-mono font-semibold text-[#fafafa] truncate">
                  {activeService.security}
                </div>
              </div>
            </div>

            {/* Supported Protocols */}
            <div className="py-4 border-b border-[#2a2a2a]">
              <div className="text-xs text-[#71717a] uppercase tracking-wider font-semibold mb-2">
                Protocols & Wire Standards
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeService.protocols.map((proto) => (
                  <span
                    key={proto}
                    className="px-2.5 py-1 rounded-md bg-[#242424] text-[#e4e4e7] font-mono text-xs border border-[#363636]"
                  >
                    {proto}
                  </span>
                ))}
              </div>
            </div>

            {/* Key Capabilities */}
            <div className="pt-4">
              <div className="text-xs text-[#71717a] uppercase tracking-wider font-semibold mb-2">
                Key Architectural Responsibilities
              </div>
              <div className="space-y-2">
                {activeService.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 text-xs text-[#b4b4b4] bg-[#141414] px-3 py-2 rounded-lg border border-[#222222]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#3ecf8e] shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Connection Inspector */}
          {activeConnection ? (
            <div className="bg-[#171717] border border-[#3ecf8e]/40 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#3ecf8e] mb-1">
                <Radio className="w-4 h-4 animate-pulse" />
                Selected Flow: {activeConnection.label}
              </div>
              <div className="text-xs text-[#d4d4d8] mt-1">{activeConnection.description}</div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono bg-[#121212] p-2 rounded-lg border border-[#262626]">
                <span className="text-[#898989]">{activeConnection.source}</span>
                <span className="text-[#3ecf8e]">→ {activeConnection.protocol} →</span>
                <span className="text-[#898989]">{activeConnection.target}</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#171717] border border-[#363636] rounded-2xl p-4">
              <div className="text-xs font-semibold text-[#fafafa] mb-2">
                Related Node Links ({relatedConnections.length})
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {relatedConnections.map((conn) => (
                  <div
                    key={conn.id}
                    onClick={() => setSelectedConnectionId(conn.id)}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#141414] hover:bg-[#202020] border border-[#262626] text-xs cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: conn.color }}
                      />
                      <span className="text-[#fafafa] font-medium">{conn.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#898989]">{conn.protocol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
