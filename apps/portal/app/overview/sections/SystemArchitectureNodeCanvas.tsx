'use client';

import { Card } from '@repo/ui/components/ui/card';
import { cn } from '@repo/ui/lib/utils';
import { Filter, Maximize2, Play, Workflow, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NodeIcon, SystemArchitectureNodeInspector } from './SystemArchitectureNodeInspector';
import {
  CANVAS_EDGES,
  CANVAS_NODES,
  COL_GAP,
  COL_WIDTH,
  COLUMN_HEADERS,
  getNodePosition,
  LEFT_PAD,
  NODE_HEIGHT,
  NODE_WIDTH,
  PIPELINE_FILTERS,
  type PipelineFilterId,
} from './system-architecture-nodes-data';

const NODE_CARD_BASE_CLASS =
  'group absolute flex cursor-pointer select-none flex-col justify-between overflow-hidden rounded-xl border-2 bg-white shadow-md transition-all duration-200';

export function SystemArchitectureNodeCanvas() {
  const [activePipeline, setActivePipeline] = useState<PipelineFilterId>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('supabase-primary');
  const [zoom, setZoom] = useState<number>(1);
  const [animatePulses, setAnimatePulses] = useState<boolean>(true);

  const selectedNode = useMemo(
    () => CANVAS_NODES.find((n) => n.id === selectedNodeId) ?? CANVAS_NODES[0]!,
    [selectedNodeId]
  );

  const activeNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of CANVAS_NODES) {
      if (activePipeline === 'all' || node.pipelines.includes(activePipeline)) {
        ids.add(node.id);
      }
    }
    return ids;
  }, [activePipeline]);

  const connectedEdges = useMemo(
    () => CANVAS_EDGES.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id),
    [selectedNode.id]
  );

  const canvasWidth = LEFT_PAD * 2 + 6 * COL_WIDTH + 5 * COL_GAP;
  const canvasHeight = 670;

  return (
    <Card
      data-testid="n8n-architecture-canvas"
      className="overflow-hidden border border-white/60 bg-white/85 shadow-glass-depth backdrop-blur-2xl"
    >
      {/* Top n8n Workflow Toolbar */}
      <div className="flex flex-col justify-between gap-4 border-border-subtle border-b bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 text-white xl:flex-row xl:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/20 shadow-inner">
            <Workflow className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white tracking-tight">
                n8n-Style System Architecture Node & Wire Canvas
              </h3>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 font-mono font-semibold text-[10px] text-emerald-300">
                LIVE TOPOLOGY · 6 TIERS
              </span>
            </div>
            <p className="mt-0.5 text-slate-300 text-xs">
              Interactive box-and-wire graph of all 16 architecture subsystems & 21 data pipelines —
              click any node to inspect inputs, outputs, and file boundaries
            </p>
          </div>
        </div>

        {/* Pipeline Scenario Filter Pills & Canvas Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/90 p-1">
            <Filter className="mr-1 ml-1.5 h-3.5 w-3.5 text-slate-400" />
            {PIPELINE_FILTERS.map((pf) => {
              const active = activePipeline === pf.id;
              return (
                <button
                  key={pf.id}
                  type="button"
                  onClick={() => setActivePipeline(pf.id)}
                  className={cn(
                    'cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-all',
                    active
                      ? 'bg-accent-blue font-semibold text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                  )}
                >
                  {pf.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/90 p-1">
            <button
              type="button"
              onClick={() => setAnimatePulses((prev) => !prev)}
              className={cn(
                'flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-mono text-[11px]',
                animatePulses
                  ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:text-white'
              )}
              title="Toggle live packet flow animation"
            >
              <Play className="h-3 w-3" />
              <span>{animatePulses ? 'Flow Live' : 'Paused'}</span>
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))))}
              aria-label="Zoom out canvas"
              className="cursor-pointer rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.15, Number((z + 0.1).toFixed(2))))}
              aria-label="Zoom in canvas"
              className="cursor-pointer rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label="Reset canvas zoom"
              className="cursor-pointer rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white"
              title="Reset zoom (100%)"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable n8n Dot-Grid Node & Wire Viewport */}
      <div
        className="relative overflow-x-auto overflow-y-hidden bg-[#f8fafc]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(100, 116, 139, 0.22) 1.25px, transparent 1.25px)',
          backgroundSize: '20px 20px',
        }}
      >
        <div
          className="relative origin-top-left transition-transform"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `scale(${zoom})`,
            marginBottom: zoom < 1 ? `${(zoom - 1) * canvasHeight}px` : '0px',
          }}
        >
          {/* Column Lane Headers */}
          {COLUMN_HEADERS.map((colHeader) => {
            const left = LEFT_PAD + colHeader.col * (COL_WIDTH + COL_GAP);
            return (
              <div
                key={colHeader.col}
                className="absolute top-3 rounded-lg border border-slate-200/90 bg-white/90 px-3 py-1.5 shadow-xs backdrop-blur-sm"
                style={{ left: `${left}px`, width: `${NODE_WIDTH}px` }}
              >
                <div className="font-bold font-mono text-[10px] text-slate-700 uppercase tracking-wider">
                  {colHeader.title}
                </div>
                <div className="truncate text-[10px] text-slate-500">{colHeader.subtitle}</div>
              </div>
            );
          })}

          {/* SVG Bezier Wires Layer */}
          <svg
            width={canvasWidth}
            height={canvasHeight}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            className="pointer-events-none absolute inset-0"
            aria-label="System Architecture Node Connections"
          >
            <defs>
              <marker
                id="n8n-arrow-active"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
              </marker>
              <marker
                id="n8n-arrow-muted"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
              </marker>
            </defs>

            {CANVAS_EDGES.map((edge) => {
              const sourceNode = CANVAS_NODES.find((n) => n.id === edge.source);
              const targetNode = CANVAS_NODES.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const srcPos = getNodePosition(sourceNode);
              const tgtPos = getNodePosition(targetNode);

              const startX = srcPos.x + NODE_WIDTH;
              const startY = srcPos.y + NODE_HEIGHT / 2;
              const endX = tgtPos.x;
              const endY = tgtPos.y + NODE_HEIGHT / 2;

              const dx = Math.max(60, (endX - startX) * 0.52);
              const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

              const isInPipeline =
                activePipeline === 'all' || edge.pipelines.includes(activePipeline);
              const isSelectedEdge =
                selectedNode.id === edge.source || selectedNode.id === edge.target;

              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              return (
                <g
                  key={edge.id}
                  style={{
                    opacity: isInPipeline ? (isSelectedEdge ? 1 : 0.78) : 0.16,
                    transition: 'opacity 200ms ease',
                  }}
                >
                  {/* Soft glow under active/selected wire */}
                  {isSelectedEdge && isInPipeline && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={6}
                      strokeOpacity={0.18}
                    />
                  )}

                  {/* Main Bezier Wire */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isInPipeline ? edge.color : '#cbd5e1'}
                    strokeWidth={isSelectedEdge ? 2.6 : 1.8}
                    strokeDasharray={animatePulses && isInPipeline ? '6 4' : undefined}
                    markerEnd={isInPipeline ? 'url(#n8n-arrow-active)' : 'url(#n8n-arrow-muted)'}
                  />

                  {/* Animated data packet dot along the bezier curve */}
                  {animatePulses && isInPipeline && (
                    <circle r={isSelectedEdge ? 4 : 3} fill={edge.color}>
                      <animateMotion
                        dur={isSelectedEdge ? '2.2s' : '3.4s'}
                        repeatCount="indefinite"
                        path={pathD}
                      />
                    </circle>
                  )}

                  {/* Edge Protocol Label Pill */}
                  {(isSelectedEdge || activePipeline !== 'all') && isInPipeline && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-54}
                        y={-10}
                        width={108}
                        height={19}
                        rx={5}
                        fill="#ffffff"
                        stroke={edge.color}
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        className="fill-slate-700 font-mono font-semibold text-[9px]"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive n8n Node Boxes Layer */}
          {CANVAS_NODES.map((node) => {
            const { x, y } = getNodePosition(node);
            const isSelected = selectedNode.id === node.id;
            const isVisible = activeNodeIds.has(node.id);
            const isConnectedToSelected = connectedEdges.some(
              (e) => e.source === node.id || e.target === node.id
            );

            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                data-testid={`n8n-node-${node.id}`}
                onClick={() => setSelectedNodeId(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNodeId(node.id);
                  }
                }}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${NODE_WIDTH}px`,
                  height: `${NODE_HEIGHT}px`,
                  borderColor: isSelected
                    ? node.color
                    : isConnectedToSelected
                      ? `${node.color}99`
                      : 'rgba(148, 163, 184, 0.45)',
                  opacity: isVisible ? 1 : 0.25,
                }}
                className={cn(
                  NODE_CARD_BASE_CLASS,
                  isSelected
                    ? 'z-20 -translate-y-0.5 shadow-xl ring-4 ring-accent-blue/20'
                    : 'z-10 hover:-translate-y-0.5 hover:shadow-lg'
                )}
              >
                {/* Top Colored Node Bar */}
                <div className="h-1.5 w-full" style={{ backgroundColor: node.color }} />

                {/* Input Connection Port (Left) */}
                {node.col > 0 && (
                  <span
                    className="absolute top-1/2 -left-2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white shadow-xs"
                    style={{ backgroundColor: node.color }}
                    title="Input Port"
                  />
                )}

                {/* Output Connection Port (Right) */}
                {node.col < 5 && (
                  <span
                    className="absolute top-1/2 -right-2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white shadow-xs"
                    style={{ backgroundColor: node.color }}
                    title="Output Port"
                  />
                )}

                {/* Node Body */}
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="rounded px-1.5 py-0.5 font-bold font-mono text-[9px] uppercase tracking-wider"
                        style={{
                          backgroundColor: `${node.color}15`,
                          color: node.color,
                        }}
                      >
                        {node.typeLabel}
                      </span>
                      <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-slate-600">
                        {node.metricBadge}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div
                        className="shrink-0 rounded-lg p-1.5"
                        style={{
                          backgroundColor: `${node.color}15`,
                          color: node.color,
                        }}
                      >
                        <NodeIcon name={node.iconName} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-900 text-xs">
                          {node.title}
                        </div>
                        <div className="truncate text-[10px] text-slate-500">{node.subtitle}</div>
                      </div>
                    </div>
                  </div>

                  {/* Node Footer Protocol Bar */}
                  <div className="mt-1.5 flex items-center justify-between border-slate-100 border-t pt-1.5 font-mono text-[10px]">
                    <span className="truncate text-slate-500">{node.protocol}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {node.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom n8n Node Inspector Drawer (Shows Selected Node Details & Connected Wires) */}
      <SystemArchitectureNodeInspector
        selectedNode={selectedNode}
        connectedEdges={connectedEdges}
        onSelectNode={setSelectedNodeId}
      />
    </Card>
  );
}
