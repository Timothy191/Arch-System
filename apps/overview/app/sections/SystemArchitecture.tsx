"use client";

import { useCallback, useMemo } from "react";
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
import { DEPARTMENTS } from "@/lib/data";

// Custom node components
function RootNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-6 py-3 bg-bg-secondary border-2 border-accent-green rounded-xl shadow-lg">
      <div className="text-accent-green font-semibold text-lg">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-accent-green" />
    </div>
  );
}

function AuthNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-5 py-2 bg-bg-secondary border border-text-muted rounded-lg">
      <div className="text-text-muted font-medium">{data.label}</div>
      <Handle type="source" position={Position.Right} className="!bg-text-muted" />
    </div>
  );
}

function AdminNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-5 py-2 bg-bg-secondary border border-accent-red rounded-lg">
      <div className="text-accent-red font-medium">{data.label}</div>
      <Handle type="source" position={Position.Left} className="!bg-accent-red" />
    </div>
  );
}

function DepartmentNode({ data }: { data: { label: string; color: string; slug: string } }) {
  const dept = DEPARTMENTS.find((d) => d.id === data.slug);

  return (
    <div
      className="w-48 bg-white/70 backdrop-blur-xl border rounded-xl overflow-hidden shadow-lg"
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />

      {/* Header */}
      <div className="px-4 py-3 border-b border-default" style={{ borderBottomColor: data.color }}>
        <div className="font-semibold text-text-heading" style={{ color: data.color }}>
          {data.label}
        </div>
        <div className="text-xs text-text-muted mt-1">{dept?.description}</div>
      </div>

      {/* Routes */}
      <div className="p-2 space-y-1">
        {dept?.routes.map((route) => (
          <div
            key={route.path}
            className="px-2 py-1.5 text-xs rounded bg-bg-tertiary text-text-secondary hover:bg-border-subtle transition-colors"
          >
            <div className="font-medium text-text-heading">{route.name}</div>
            <div className="text-[10px] text-text-muted">{route.path}</div>
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = {
  root: RootNode,
  auth: AuthNode,
  admin: AdminNode,
  department: DepartmentNode,
};

export default function SystemArchitecture() {
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [
      // Hub - center top
      {
        id: "hub",
        type: "root",
        position: { x: 550, y: 30 },
        data: { label: "Hub" },
      },
      // Login - left
      {
        id: "login",
        type: "auth",
        position: { x: 50, y: 50 },
        data: { label: "Login" },
      },
      // Admin - right
      {
        id: "admin",
        type: "admin",
        position: { x: 1050, y: 50 },
        data: { label: "Admin" },
      },
    ];

    // Department nodes - arranged horizontally
    const deptWidth = 200;
    const gap = 20;
    const startX = 50;
    const y = 250;

    DEPARTMENTS.forEach((dept, index) => {
      nodes.push({
        id: dept.id,
        type: "department",
        position: { x: startX + index * (deptWidth + gap), y },
        data: { label: dept.name, color: dept.color, slug: dept.id },
      });
    });

    return nodes;
  }, []);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [
      // Login -> Hub
      {
        id: "e-login-hub",
        source: "login",
        target: "hub",
        animated: true,
        style: { stroke: "var(--text-muted)" },
      },
      // Admin -> Hub
      {
        id: "e-admin-hub",
        source: "admin",
        target: "hub",
        animated: true,
        style: { stroke: "var(--accent-red)" },
      },
    ];

    // Hub -> each department
    DEPARTMENTS.forEach((dept) => {
      edges.push({
        id: `e-hub-${dept.id}`,
        source: "hub",
        target: dept.id,
        animated: true,
        style: { stroke: dept.color },
      });
    });

    return edges;
  }, []);

  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="var(--border-default)" gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "root") return "var(--accent-green)";
            if (node.type === "auth") return "var(--text-muted)";
            if (node.type === "admin") return "var(--accent-red)";
            return (node.data.color as string) || "var(--accent-green)";
          }}
          maskColor="var(--overlay-medium)"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/70 backdrop-blur-xl border border-black/[0.08] rounded-lg p-4 text-sm">
        <div className="text-text-heading font-medium mb-2">Navigation Flow</div>
        <div className="space-y-1.5 text-text-secondary">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-text-muted" />
            <span>Authentication</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-accent-green" />
            <span>Hub / Central</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-accent-red" />
            <span>Admin Access</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-accent-blue" />
            <span>Department</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-text-muted">Drag nodes to rearrange • Scroll to zoom</div>
      </div>
    </div>
  );
}
