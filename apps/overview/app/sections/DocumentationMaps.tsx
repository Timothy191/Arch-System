"use client";

import { useState, useEffect } from "react";
import {
  Map,
  FileText,
  ShieldCheck,
  Layers,
  GitBranch,
  Database,
  History,
  RefreshCw,
} from "lucide-react";
import { Card } from "@repo/ui/components/ui/card";

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

const MAP_FILES = [
  { key: "nx-graph.md", label: "Nx 22 Project Graph & Pipeline", icon: Layers },
  { key: "dependencies-graph.md", label: "Monorepo Dependencies Topology Graph", icon: GitBranch },
  { key: "route-feature-architecture.md", label: "Route & Feature Architecture", icon: Map },
  { key: "database-schema.md", label: "Database Schema & Topology", icon: Database },
  { key: "ci-cd-pipeline.md", label: "CI/CD Pipeline & Quality Gate", icon: GitBranch },
  { key: "technology-stack.md", label: "Technology Stack Catalog", icon: Layers },
  { key: "project-dependencies.md", label: "Project Dependencies Graph", icon: ShieldCheck },
  { key: "package-structure.md", label: "Package Structure & Modules", icon: FileText },
];

export default function DocumentationMaps() {
  const [data, setData] = useState<CodebaseMapsData | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string>("latest");
  const [selectedFileKey, setSelectedFileKey] = useState<string>("route-feature-architecture.md");
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMapsData = async (logId: string, fileKey: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/codebase-maps?log=${logId}&file=${fileKey}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Ignored for zero-console-warning lint rule
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapsData(selectedLogId, selectedFileKey);
  }, [selectedLogId, selectedFileKey]);

  const activeMeta =
    data?.manifest?.find((m) => m.id === selectedLogId || m.folderName === selectedLogId) ||
    data?.manifest?.[0];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="p-6 bg-white/70 border-[var(--border-subtle)] shadow-card backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-accent-blue/10 text-[var(--accent-blue)] border border-accent-blue/20">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-heading)] flex items-center gap-2">
                Automated Codebase Maps & Topology Catalog
                {activeMeta && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {activeMeta.folderName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Versioned architecture maps, route hierarchies, database schema topology, and CI/CD
                pipelines
              </p>
            </div>
          </div>

          {/* History Selector Dropdown */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
              <History className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Map History:</span>
              <select
                value={selectedLogId}
                onChange={(e) => setSelectedLogId(e.target.value)}
                className="bg-transparent text-[var(--text-heading)] font-mono text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="latest">Latest Maps (codebase-maps/latest)</option>
                {data?.manifest
                  ?.filter(
                    (log, index, self) =>
                      self.findIndex(
                        (item) => (item.folderName || item.id) === (log.folderName || log.id),
                      ) === index,
                  )
                  .map((log, idx) => (
                    <option key={`${log.id}-${log.isoDate || idx}`} value={log.folderName}>
                      {log.folderName} — {log.displayDate} ({log.mapCount} maps)
                    </option>
                  ))}
              </select>
            </div>

            <button
              onClick={() => fetchMapsData(selectedLogId, selectedFileKey)}
              className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)] transition-colors"
              title="Refresh Maps Index"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-[var(--accent-blue)]" : ""}`}
              />
            </button>
          </div>
        </div>
      </Card>

      {/* Map File Selection Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {MAP_FILES.map((file) => {
          const Icon = file.icon;
          const isSelected = selectedFileKey === file.key;
          return (
            <button
              key={file.key}
              onClick={() => setSelectedFileKey(file.key)}
              className={`flex flex-col items-center text-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                isSelected
                  ? "bg-[var(--accent-blue)] text-white border-[var(--accent-blue)] shadow-md"
                  : "bg-white/70 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-secondary)]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="leading-tight">{file.label}</span>
            </button>
          );
        })}
      </div>

      {/* Codebase Map Viewer */}
      <Card className="p-6 bg-white/70 border-[var(--border-subtle)] shadow-card backdrop-blur-xl min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-blue)]" />
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Loading codebase map content...
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                <FileText className="w-4 h-4 text-[var(--accent-blue)]" />
                <span>
                  codebase-maps/{selectedLogId}/{selectedFileKey}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent-green)] text-xs font-mono">
                Verified & Active Index
              </span>
            </div>

            <pre className="p-4 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-heading)] whitespace-pre-wrap overflow-x-auto leading-relaxed">
              {data?.content || "No map content loaded."}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
