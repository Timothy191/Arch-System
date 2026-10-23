'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Book } from '@repo/ui/components/ui/book';
import { Card } from '@repo/ui/components/ui/card';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  FileText,
  GitBranch,
  History,
  Layers,
  LayoutGrid,
  Map as MapIcon,
  Network,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  CODEBASE_MAP_BY_KEY,
  CODEBASE_MAP_SPECS,
  type CodebaseMapSpec,
} from '../lib/codebase-maps-data';

interface MapFileMeta {
  key: string;
  filename: string;
  title: string;
  category: string;
  summary: string;
  relativePath: string;
  sizeBytes: number;
}

interface MapLogMeta {
  id: string;
  logNumber: number;
  folderName: string;
  folderDate: string;
  isoDate: string;
  displayDate: string;
  mapCount: number;
  status: string;
  maps: MapFileMeta[];
}

interface CodebaseMapsData {
  manifest: MapLogMeta[];
  activeLogId: string;
  activeFileKey: string;
  content: string;
}

const MAP_ICON_BY_KEY: Record<string, ComponentType<{ className?: string }>> = {
  'turbo-graph.md': Workflow,
  'dependencies-graph.md': Network,
  'route-feature-architecture.md': MapIcon,
  'database-schema.md': Database,
  'multi-agent-architecture.md': Bot,
  'ci-cd-pipeline.md': GitBranch,
  'technology-stack.md': Layers,
  'project-dependencies.md': ShieldCheck,
  'package-structure.md': FileText,
};

type MapViewMode = 'visual-and-spec' | 'pipeline-only' | 'markdown-only';

export default function DocumentationMaps() {
  const [data, setData] = useState<CodebaseMapsData | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string>('latest');
  const [selectedFileKey, setSelectedFileKey] = useState<string>('turbo-graph.md');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('turbo-inputs');
  const [viewMode, setViewMode] = useState<MapViewMode>('visual-and-spec');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchMapsData = useCallback(async (logId: string, fileKey: string) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/codebase-maps?log=${logId}&file=${fileKey}`);
      if (res.ok) {
        const json: CodebaseMapsData = await res.json();
        setData(json);
      }
    } catch {
      // Fallback to built-in canonical map specs when offline or unauthenticated in preview
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchMapsData(selectedLogId, selectedFileKey);
  }, [selectedLogId, selectedFileKey, fetchMapsData]);

  // Reset selected pipeline node when switching maps
  const activeSpec: CodebaseMapSpec =
    CODEBASE_MAP_BY_KEY[selectedFileKey] ?? (CODEBASE_MAP_SPECS[0] as CodebaseMapSpec);

  useEffect(() => {
    const firstNode = activeSpec.pipelineNodes[0];
    if (firstNode) {
      setSelectedNodeId(firstNode.id);
    }
  }, [activeSpec]);

  const activeMeta =
    data?.manifest?.find((m) => m.id === selectedLogId || m.folderName === selectedLogId) ||
    data?.manifest?.[0];
  const ActiveFileIcon = MAP_ICON_BY_KEY[selectedFileKey] ?? FileText;
  const inspectedNode =
    activeSpec.pipelineNodes.find((n) => n.id === selectedNodeId) ?? activeSpec.pipelineNodes[0];

  const resolvedMarkdown =
    data?.activeFileKey === selectedFileKey &&
    data?.content &&
    !data.content.includes('Map content unavailable.')
      ? data.content
      : activeSpec.markdownContent;

  const handleCopyMarkdown = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(resolvedMarkdown).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [resolvedMarkdown]);

  return (
    <div className="space-y-6" data-testid="documentation-maps-section">
      {/* Top Design-System Header Panel */}
      <Card
        data-testid="documentation-maps-header-panel"
        className="relative space-y-5 overflow-hidden border border-white/60 bg-white/80 p-6 shadow-glass-depth backdrop-blur-2xl"
      >
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-accent-blue via-emerald-500 to-indigo-600" />

        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 shrink-0 rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-3 text-[var(--accent-blue)]">
              <MapIcon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-2.5 py-0.5 font-mono font-semibold text-[10px] text-accent-blue uppercase tracking-wider">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-blue" />
                Automated AST & Pipeline Intelligence · 9 / 9 Maps Verified
              </div>
              <h2 className="flex flex-wrap items-center gap-2 font-bold text-[var(--text-heading)] text-xl sm:text-2xl">
                <span>Automated Codebase Maps & Topology Catalog</span>
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-0.5 font-mono font-semibold text-[var(--text-secondary)] text-xs">
                  {activeMeta?.folderName ?? 'codebase-maps/latest'}
                </span>
              </h2>
              <p className="max-w-3xl text-[var(--text-secondary)] text-xs sm:text-sm">
                Interactive visual block-and-line graphs, Turborepo task pipelines, monorepo scope
                boundaries, PostgreSQL 17 RLS schemas, and CI/CD quality gates across all 9
                canonical maps.
              </p>
            </div>
          </div>

          {/* Controls: History Selector + Refresh + View Mode */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 self-start">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[var(--text-secondary)] text-xs">
              <History className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              <span className="font-medium">Snapshot:</span>
              <select
                aria-label="Select codebase map snapshot history"
                value={selectedLogId}
                onChange={(e) => setSelectedLogId(e.target.value)}
                className="cursor-pointer bg-transparent font-mono font-semibold text-[var(--text-heading)] text-xs focus:outline-none"
              >
                <option value="latest">Latest (codebase-maps/latest)</option>
                {data?.manifest
                  ?.filter(
                    (log, index, self) =>
                      self.findIndex(
                        (item) => (item.folderName || item.id) === (log.folderName || log.id)
                      ) === index
                  )
                  .map((log, idx) => (
                    <option key={`${log.id}-${log.isoDate || idx}`} value={log.folderName}>
                      {log.folderName} — {log.displayDate} ({log.mapCount} maps)
                    </option>
                  ))}
              </select>
            </div>

            {/* Segmented View Toggle */}
            <div
              role="group"
              aria-label="Codebase map visualization mode"
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1"
            >
              <button
                type="button"
                data-testid="map-view-visual-and-spec"
                aria-pressed={viewMode === 'visual-and-spec'}
                onClick={() => setViewMode('visual-and-spec')}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium text-xs transition-all ${
                  viewMode === 'visual-and-spec'
                    ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Visual & Spec</span>
              </button>
              <button
                type="button"
                data-testid="map-view-pipeline-only"
                aria-pressed={viewMode === 'pipeline-only'}
                onClick={() => setViewMode('pipeline-only')}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium text-xs transition-all ${
                  viewMode === 'pipeline-only'
                    ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                <Workflow className="h-3.5 w-3.5" />
                <span>Pipeline Graph</span>
              </button>
              <button
                type="button"
                data-testid="map-view-markdown-only"
                aria-pressed={viewMode === 'markdown-only'}
                onClick={() => setViewMode('markdown-only')}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium text-xs transition-all ${
                  viewMode === 'markdown-only'
                    ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Raw Markdown</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchMapsData(selectedLogId, selectedFileKey)}
              className="cursor-pointer rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
              title="Refresh Maps Index"
              aria-label="Refresh Maps Index"
            >
              <RefreshCw
                className={`h-4 w-4 ${isSyncing ? 'animate-spin text-[var(--accent-blue)]' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* All 9 Map Selection Cards inside Header Panel */}
        <div
          data-testid="codebase-map-selector-grid"
          className="grid grid-cols-1 gap-2 border-[var(--border-subtle)] border-t pt-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-9"
        >
          {CODEBASE_MAP_SPECS.map((spec) => {
            const Icon = MAP_ICON_BY_KEY[spec.key] ?? FileText;
            const isSelected = selectedFileKey === spec.key;
            return (
              <button
                type="button"
                key={spec.key}
                data-testid={`map-selector-${spec.key}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedFileKey(spec.key)}
                className={`relative flex cursor-pointer flex-col items-start justify-between gap-2 overflow-hidden rounded-xl border p-3 text-left font-medium text-xs transition-all ${
                  isSelected
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white shadow-md'
                    : 'border-[var(--border-subtle)] bg-white/80 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1.5">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isSelected ? 'text-white' : 'text-[var(--accent-blue)]'
                    }`}
                  />
                  <span
                    className={`truncate rounded px-1.5 py-0.5 font-mono text-[9px] ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                    }`}
                  >
                    {spec.category}
                  </span>
                </div>
                <span className="line-clamp-2 font-semibold leading-snug">{spec.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Active Codebase Map Viewer Card */}
      <Card
        data-testid="active-codebase-map-viewer"
        className="space-y-6 border border-white/60 bg-white/80 p-6 shadow-glass-depth backdrop-blur-2xl"
      >
        {/* Active Map Header & 4 KPI Tiles */}
        <div className="space-y-5 border-[var(--border-subtle)] border-b pb-5">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <Book
                title={activeSpec.shortLabel}
                subtitle={activeMeta?.folderName ?? 'Topology'}
                variant="stripe"
                color={activeSpec.accentColor}
                icon={<ActiveFileIcon className="h-3.5 w-3.5" />}
                width={110}
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[var(--text-muted)] text-xs">
                  <FileText className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                  <span>
                    codebase-maps/{selectedLogId}/{activeSpec.key}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {activeSpec.category}
                  </Badge>
                </div>
                <h3 className="font-bold text-[var(--text-heading)] text-lg sm:text-xl">
                  {activeSpec.label}
                </h3>
                <p className="max-w-3xl text-[var(--text-secondary)] text-xs sm:text-sm">
                  {activeSpec.subtitle}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono font-semibold text-emerald-700 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified & Active Index
              </span>
            </div>
          </div>

          {/* 4 Map-Specific KPI Cards */}
          <div
            data-testid="active-map-kpis"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {activeSpec.kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="space-y-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 px-4 py-3"
              >
                <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  {kpi.label}
                </div>
                <div className="font-bold text-[var(--text-heading)] text-base">{kpi.value}</div>
                <div className="text-[11px] text-[var(--text-secondary)] leading-snug">
                  {kpi.detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Pipeline & Topology View (shown in 'visual-and-spec' and 'pipeline-only') */}
        {viewMode !== 'markdown-only' && (
          <div className="space-y-6" data-testid="codebase-map-visual-pipeline">
            {/* 1. Interactive 5-Stage Block-and-Line Pipeline Diagram */}
            <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 p-5">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm sm:text-base">
                    <Workflow className="h-4 w-4 text-[var(--accent-blue)]" />
                    {activeSpec.pipelineTitle}
                  </h4>
                  <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                    {activeSpec.pipelineSubtitle}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="w-fit border-accent-blue/30 bg-accent-blue/10 font-mono text-[10px] text-[var(--accent-blue)]"
                >
                  {activeSpec.pipelineBadge}
                </Badge>
              </div>

              {/* Connected 5-Stage Pipeline Nodes + Arrows */}
              <div className="grid grid-cols-1 items-stretch gap-2 lg:grid-cols-9">
                {activeSpec.pipelineNodes.map((node, idx) => {
                  const isNodeSelected = inspectedNode?.id === node.id;
                  return (
                    <div key={node.id} className="contents">
                      <button
                        type="button"
                        data-testid={`pipeline-node-${node.id}`}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`flex min-h-[164px] cursor-pointer flex-col justify-between rounded-xl border-2 bg-white p-3.5 text-left transition-all lg:col-span-1 ${
                          isNodeSelected
                            ? 'shadow-md ring-2 ring-[var(--accent-blue)]/30'
                            : 'shadow-sm hover:shadow-md'
                        }`}
                        style={{
                          borderColor: isNodeSelected ? node.color : `${node.color}55`,
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="rounded px-1.5 py-0.5 font-bold font-mono text-[9px]"
                              style={{
                                backgroundColor: `${node.color}18`,
                                color: node.color,
                              }}
                            >
                              {node.step}
                            </span>
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: node.color }}
                            />
                          </div>
                          <div className="mt-2 font-semibold text-[var(--text-heading)] text-xs leading-snug">
                            {node.title}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                            {node.role}
                          </div>
                          <p className="mt-1.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                            {node.detail}
                          </p>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-1 border-[var(--border-subtle)] border-t pt-1.5 font-mono text-[9px] text-[var(--accent-blue)]">
                          <span className="truncate">{node.protocol}</span>
                          <span className="shrink-0 text-[var(--text-muted)]">Inspect ›</span>
                        </div>
                      </button>

                      {idx < activeSpec.pipelineNodes.length - 1 && (
                        <div className="flex items-center justify-center py-1 lg:col-span-1 lg:flex-col lg:py-0">
                          <div className="hidden w-full items-center lg:flex">
                            <div
                              className="h-0.5 flex-1"
                              style={{
                                background: `linear-gradient(90deg, ${node.color}, ${
                                  activeSpec.pipelineNodes[idx + 1]?.color ?? node.color
                                })`,
                              }}
                            />
                            <ArrowRight
                              className="-ml-1 h-4 w-4 shrink-0"
                              style={{
                                color: activeSpec.pipelineNodes[idx + 1]?.color ?? node.color,
                              }}
                            />
                          </div>
                          <span className="mt-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-center font-mono text-[9px] text-[var(--text-muted)]">
                            {node.protocol}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Interactive Selected Stage Inspector */}
              {inspectedNode && (
                <div
                  data-testid="codebase-map-node-inspector"
                  className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-white/90 p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 font-bold font-mono text-[10px]"
                        style={{
                          backgroundColor: `${inspectedNode.color}18`,
                          color: inspectedNode.color,
                        }}
                      >
                        {inspectedNode.step} · ACTIVE STAGE INSPECTOR
                      </span>
                      <span className="font-bold text-[var(--text-heading)] text-xs">
                        {inspectedNode.title}
                      </span>
                      <span className="font-mono text-[var(--text-muted)] text-xs">
                        ({inspectedNode.role})
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] text-xs">{inspectedNode.detail}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 font-mono text-[11px]">
                    <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[var(--text-secondary)]">
                      SSoT:{' '}
                      <strong className="text-[var(--text-heading)]">
                        {inspectedNode.ssotPath}
                      </strong>
                    </span>
                    <span className="rounded-lg border border-accent-blue/20 bg-accent-blue/10 px-2.5 py-1 text-[var(--accent-blue)]">
                      {inspectedNode.protocol}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Topology Hierarchy & Scope Tagging Matrix (4 Cards) */}
            <div className="space-y-3" data-testid="codebase-map-topology-groups">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-sm sm:text-base">
                    <Layers className="h-4 w-4 text-[var(--accent-blue)]" />
                    {activeSpec.topologyTitle}
                  </h4>
                  <p className="text-[var(--text-secondary)] text-xs">
                    {activeSpec.topologySubtitle}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeSpec.topologyGroups.map((group) => (
                  <div
                    key={group.title}
                    className="flex flex-col justify-between overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white/90 shadow-xs"
                  >
                    <div className="h-1 w-full" style={{ backgroundColor: group.color }} />
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-bold text-[var(--text-heading)] text-sm">
                            {group.title}
                          </h5>
                          <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                            {group.scopeTag}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                          {group.badge}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.name}
                            className="space-y-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/70 p-2.5"
                          >
                            <div className="font-mono font-semibold text-[var(--text-heading)] text-xs">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)]">
                              {item.role}
                            </div>
                            <div className="font-mono text-[10px] text-[var(--accent-blue)]">
                              Rule: {item.rule}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Boundary & Governance Enforcement Matrix */}
            <div
              data-testid="codebase-map-boundary-matrix"
              className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white/90"
            >
              <div className="flex flex-col justify-between gap-2 border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/80 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                    Machine-Enforced Boundary & Verification Matrix
                  </span>
                </div>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-700">
                  100% Automated Gate Coverage
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)]/40 font-mono text-[10px] text-[var(--text-muted)] uppercase">
                      <th className="px-4 py-2.5">Source / Scope</th>
                      <th className="px-4 py-2.5">Allowed Targets & Contracts</th>
                      <th className="px-4 py-2.5">Forbidden Targets</th>
                      <th className="px-4 py-2.5">Enforcement Gate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {activeSpec.boundaryRules.map((rule) => (
                      <tr key={rule.source} className="hover:bg-[var(--bg-secondary)]/30">
                        <td className="px-4 py-2.5 font-mono font-semibold text-[var(--text-heading)]">
                          {rule.source}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-emerald-700">{rule.allowed}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-rose-700">
                          {rule.forbidden}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--accent-blue)]">
                          {rule.gate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Canonical Markdown Specification Panel (shown in 'visual-and-spec' and 'markdown-only') */}
        {viewMode !== 'pipeline-only' && (
          <div className="space-y-2.5" data-testid="codebase-map-markdown-spec">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-[var(--text-secondary)] text-xs">
                <Terminal className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                <span>Canonical Codemap Markdown Specification ({activeSpec.key})</span>
              </div>
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 font-mono text-[var(--text-secondary)] text-xs transition-colors hover:text-[var(--text-heading)]"
              >
                <Copy className="h-3 w-3" />
                <span>{copied ? 'Copied!' : 'Copy Spec'}</span>
              </button>
            </div>
            <pre className="max-h-[420px] overflow-x-auto whitespace-pre-wrap rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/70 p-4 font-mono text-[var(--text-heading)] text-xs leading-relaxed">
              {resolvedMarkdown}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
