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
        className="p-6 border border-white/60 bg-white/80 backdrop-blur-2xl shadow-glass-depth space-y-5 relative overflow-hidden"
      >
        <div className="h-1 w-full absolute top-0 left-0 bg-gradient-to-r from-accent-blue via-emerald-500 to-indigo-600" />

        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-accent-blue/10 text-[var(--accent-blue)] border border-accent-blue/20 shrink-0 mt-0.5">
              <MapIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-[10px] font-mono uppercase tracking-wider text-accent-blue font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
                Automated AST & Pipeline Intelligence · 9 / 9 Maps Verified
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-heading)] flex flex-wrap items-center gap-2">
                <span>Automated Codebase Maps & Topology Catalog</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  {activeMeta?.folderName ?? 'codebase-maps/latest'}
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl">
                Interactive visual block-and-line graphs, Turborepo task pipelines, monorepo scope
                boundaries, PostgreSQL 17 RLS schemas, and CI/CD quality gates across all 9
                canonical maps.
              </p>
            </div>
          </div>

          {/* Controls: History Selector + Refresh + View Mode */}
          <div className="flex flex-wrap items-center gap-2.5 self-start shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
              <History className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <span className="font-medium">Snapshot:</span>
              <select
                aria-label="Select codebase map snapshot history"
                value={selectedLogId}
                onChange={(e) => setSelectedLogId(e.target.value)}
                className="bg-transparent text-[var(--text-heading)] font-mono text-xs font-semibold focus:outline-none cursor-pointer"
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
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
            >
              <button
                type="button"
                data-testid="map-view-visual-and-spec"
                aria-pressed={viewMode === 'visual-and-spec'}
                onClick={() => setViewMode('visual-and-spec')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'visual-and-spec'
                    ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Visual & Spec</span>
              </button>
              <button
                type="button"
                data-testid="map-view-pipeline-only"
                aria-pressed={viewMode === 'pipeline-only'}
                onClick={() => setViewMode('pipeline-only')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'pipeline-only'
                    ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>Pipeline Graph</span>
              </button>
              <button
                type="button"
                data-testid="map-view-markdown-only"
                aria-pressed={viewMode === 'markdown-only'}
                onClick={() => setViewMode('markdown-only')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'markdown-only'
                    ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Raw Markdown</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchMapsData(selectedLogId, selectedFileKey)}
              className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              title="Refresh Maps Index"
              aria-label="Refresh Maps Index"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[var(--accent-blue)]' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* All 9 Map Selection Cards inside Header Panel */}
        <div
          data-testid="codebase-map-selector-grid"
          className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-9 gap-2 pt-3 border-t border-[var(--border-subtle)]"
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
                className={`flex flex-col items-start justify-between text-left gap-2 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)] shadow-md'
                    : 'bg-white/80 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-1.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-white' : 'text-[var(--accent-blue)]'
                    }`}
                  />
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded truncate ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                    }`}
                  >
                    {spec.category}
                  </span>
                </div>
                <span className="leading-snug font-semibold line-clamp-2">{spec.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Active Codebase Map Viewer Card */}
      <Card
        data-testid="active-codebase-map-viewer"
        className="p-6 bg-white/80 border border-white/60 shadow-glass-depth backdrop-blur-2xl space-y-6"
      >
        {/* Active Map Header & 4 KPI Tiles */}
        <div className="space-y-5 border-b border-[var(--border-subtle)] pb-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Book
                title={activeSpec.shortLabel}
                subtitle={activeMeta?.folderName ?? 'Topology'}
                variant="stripe"
                color={activeSpec.accentColor}
                icon={<ActiveFileIcon className="w-3.5 h-3.5" />}
                width={110}
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                  <FileText className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                  <span>
                    codebase-maps/{selectedLogId}/{activeSpec.key}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {activeSpec.category}
                  </Badge>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[var(--text-heading)]">
                  {activeSpec.label}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl">
                  {activeSpec.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-mono font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified & Active Index
              </span>
            </div>
          </div>

          {/* 4 Map-Specific KPI Cards */}
          <div
            data-testid="active-map-kpis"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {activeSpec.kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)]/80 border border-[var(--border-subtle)] space-y-1"
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  {kpi.label}
                </div>
                <div className="text-base font-bold text-[var(--text-heading)]">{kpi.value}</div>
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
            <div className="p-5 rounded-xl bg-[var(--bg-secondary)]/60 border border-[var(--border-subtle)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-[var(--text-heading)] flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-[var(--accent-blue)]" />
                    {activeSpec.pipelineTitle}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {activeSpec.pipelineSubtitle}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono w-fit text-[var(--accent-blue)] border-accent-blue/30 bg-accent-blue/10"
                >
                  {activeSpec.pipelineBadge}
                </Badge>
              </div>

              {/* Connected 5-Stage Pipeline Nodes + Arrows */}
              <div className="grid grid-cols-1 lg:grid-cols-9 gap-2 items-stretch">
                {activeSpec.pipelineNodes.map((node, idx) => {
                  const isNodeSelected = inspectedNode?.id === node.id;
                  return (
                    <div key={node.id} className="contents">
                      <button
                        type="button"
                        data-testid={`pipeline-node-${node.id}`}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`lg:col-span-1 p-3.5 rounded-xl bg-white border-2 text-left flex flex-col justify-between min-h-[164px] transition-all cursor-pointer ${
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
                              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${node.color}18`,
                                color: node.color,
                              }}
                            >
                              {node.step}
                            </span>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: node.color }}
                            />
                          </div>
                          <div className="text-xs font-semibold text-[var(--text-heading)] mt-2 leading-snug">
                            {node.title}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                            {node.role}
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                            {node.detail}
                          </p>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-1 text-[9px] font-mono text-[var(--accent-blue)]">
                          <span className="truncate">{node.protocol}</span>
                          <span className="text-[var(--text-muted)] shrink-0">Inspect ›</span>
                        </div>
                      </button>

                      {idx < activeSpec.pipelineNodes.length - 1 && (
                        <div className="lg:col-span-1 flex lg:flex-col items-center justify-center py-1 lg:py-0">
                          <div className="hidden lg:flex items-center w-full">
                            <div
                              className="h-0.5 flex-1"
                              style={{
                                background: `linear-gradient(90deg, ${node.color}, ${
                                  activeSpec.pipelineNodes[idx + 1]?.color ?? node.color
                                })`,
                              }}
                            />
                            <ArrowRight
                              className="w-4 h-4 -ml-1 shrink-0"
                              style={{
                                color: activeSpec.pipelineNodes[idx + 1]?.color ?? node.color,
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] mt-1 text-center">
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
                  className="p-3.5 rounded-xl bg-white/90 border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${inspectedNode.color}18`,
                          color: inspectedNode.color,
                        }}
                      >
                        {inspectedNode.step} · ACTIVE STAGE INSPECTOR
                      </span>
                      <span className="text-xs font-bold text-[var(--text-heading)]">
                        {inspectedNode.title}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        ({inspectedNode.role})
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{inspectedNode.detail}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0 text-[11px] font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      SSoT:{' '}
                      <strong className="text-[var(--text-heading)]">
                        {inspectedNode.ssotPath}
                      </strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-[var(--accent-blue)]">
                      {inspectedNode.protocol}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Topology Hierarchy & Scope Tagging Matrix (4 Cards) */}
            <div className="space-y-3" data-testid="codebase-map-topology-groups">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-[var(--text-heading)] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[var(--accent-blue)]" />
                    {activeSpec.topologyTitle}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {activeSpec.topologySubtitle}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSpec.topologyGroups.map((group) => (
                  <div
                    key={group.title}
                    className="rounded-xl border border-[var(--border-subtle)] bg-white/90 overflow-hidden shadow-xs flex flex-col justify-between"
                  >
                    <div className="h-1 w-full" style={{ backgroundColor: group.color }} />
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="text-sm font-bold text-[var(--text-heading)]">
                            {group.title}
                          </h5>
                          <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                            {group.scopeTag}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                          {group.badge}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.name}
                            className="p-2.5 rounded-lg bg-[var(--bg-secondary)]/70 border border-[var(--border-subtle)] space-y-1"
                          >
                            <div className="text-xs font-semibold text-[var(--text-heading)] font-mono">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)]">
                              {item.role}
                            </div>
                            <div className="text-[10px] font-mono text-[var(--accent-blue)]">
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
              className="rounded-xl border border-[var(--border-subtle)] bg-white/90 overflow-hidden"
            >
              <div className="px-4 py-3 bg-[var(--bg-secondary)]/80 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-heading)]">
                    Machine-Enforced Boundary & Verification Matrix
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  100% Automated Gate Coverage
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 text-[10px] font-mono uppercase text-[var(--text-muted)]">
                      <th className="py-2.5 px-4">Source / Scope</th>
                      <th className="py-2.5 px-4">Allowed Targets & Contracts</th>
                      <th className="py-2.5 px-4">Forbidden Targets</th>
                      <th className="py-2.5 px-4">Enforcement Gate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {activeSpec.boundaryRules.map((rule) => (
                      <tr key={rule.source} className="hover:bg-[var(--bg-secondary)]/30">
                        <td className="py-2.5 px-4 font-mono font-semibold text-[var(--text-heading)]">
                          {rule.source}
                        </td>
                        <td className="py-2.5 px-4 text-emerald-700 font-medium">{rule.allowed}</td>
                        <td className="py-2.5 px-4 text-rose-700 font-mono text-[11px]">
                          {rule.forbidden}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[var(--accent-blue)]">
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
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
                <Terminal className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                <span>Canonical Codemap Markdown Specification ({activeSpec.key})</span>
              </div>
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copied!' : 'Copy Spec'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-heading)] whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[420px]">
              {resolvedMarkdown}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
