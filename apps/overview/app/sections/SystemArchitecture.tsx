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
    <div className="px-6 py-3 bg-[#171717] border-2 border-[#3ecf8e] rounded-xl shadow-lg">
      <div className="text-[#3ecf8e] font-semibold text-lg">{data.label}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#3ecf8e]"
      />
    </div>
  );
}

function AuthNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-5 py-2 bg-[#171717] border border-[#898989] rounded-lg">
      <div className="text-[#898989] font-medium">{data.label}</div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#898989]"
      />
    </div>
  );
}

function AdminNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-5 py-2 bg-[#171717] border border-[#ef4444] rounded-lg">
      <div className="text-[#ef4444] font-medium">{data.label}</div>
      <Handle
        type="source"
        position={Position.Left}
        className="!bg-[#ef4444]"
      />
    </div>
  );
}

function DepartmentNode({
  data,
}: {
  data: { label: string; color: string; slug: string };
}) {
  const dept = DEPARTMENTS.find((d) => d.id === data.slug);

  return (
    <div
      className="w-48 bg-[#171717] border rounded-xl overflow-hidden shadow-lg"
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />

      {/* Header */}
      <div
        className="px-4 py-3 border-b border-[#363636]"
        style={{ borderBottomColor: data.color }}
      >
        <div
          className="font-semibold text-[#fafafa]"
          style={{ color: data.color }}
        >
          {data.label}
        </div>
        <div className="text-xs text-[#898989] mt-1">{dept?.description}</div>
      </div>

      {/* Routes */}
      <div className="p-2 space-y-1">
        {dept?.routes.map((route) => (
          <div
            key={route.path}
            className="px-2 py-1.5 text-xs rounded bg-[#242424] text-[#b4b4b4] hover:bg-[#363636] transition-colors"
          >
            <div className="font-medium text-[#fafafa]">{route.name}</div>
            <div className="text-[10px] text-[#898989]">{route.path}</div>
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
        style: { stroke: "#898989" },
      },
      // Admin -> Hub
      {
        id: "e-admin-hub",
        source: "admin",
        target: "hub",
        animated: true,
        style: { stroke: "#ef4444" },
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
        <Background color="#363636" gap={16} size={1} />
        <Controls className="!bg-[#171717] !border-[#363636]" />
        <MiniMap
          className="!bg-[#171717] !border-[#363636]"
          nodeColor={(node) => {
            if (node.type === "root") return "#3ecf8e";
            if (node.type === "auth") return "#898989";
            if (node.type === "admin") return "#ef4444";
            return (node.data.color as string) || "#3ecf8e";
          }}
          maskColor="rgba(15, 15, 15, 0.7)"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-[#171717]/90 backdrop-blur-sm border border-[#363636] rounded-lg p-4 text-sm">
        <div className="text-[#fafafa] font-medium mb-2">Navigation Flow</div>
        <div className="space-y-1.5 text-[#b4b4b4]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#898989]" />
            <span>Authentication</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#3ecf8e]" />
            <span>Hub / Central</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#ef4444]" />
            <span>Admin Access</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#60a5fa]" />
            <span>Department</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-[#898989]">
          Drag nodes to rearrange • Scroll to zoom
        </div>
      </div>
    </div>
  );
}
