"use client";

import { useState } from "react";
import {
  BookOpen,
  Map,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Search,
  Layers,
  GitBranch,
  Database,
  Terminal,
  Cpu,
} from "lucide-react";

interface DocItem {
  id: string;
  title: string;
  category: "Codebase Maps" | "System Wiki" | "Agentic Wiki" | "Core Specs";
  icon: typeof Map;
  summary: string;
  path: string;
  highlights: string[];
  status: "Verified & Active" | "Synchronized";
}

const DOCS_CATALOG: DocItem[] = [
  {
    id: "route-feature",
    title: "Route & Feature Architecture Map",
    category: "Codebase Maps",
    icon: Map,
    summary:
      "Maps all Next.js 16 App Router route groups ((departments), (auth), api, admin), co-located server actions, and shared feature libraries.",
    path: "codebase-maps/route-feature-architecture_26-08-18.md",
    highlights: [
      "7 Core Mining Departments: control-room, engineering, safety, environmental, geology, production, processing",
      "Department proxying via server/proxy.ts and RBAC permission guards",
      "Server actions co-located per feature domain with Zod input contracts",
    ],
    status: "Verified & Active",
  },
  {
    id: "db-schema-map",
    title: "Database Schema & Topology Map",
    category: "Codebase Maps",
    icon: Database,
    summary:
      "Complete Postgres database schema mapping 79 tables, 97 migrations, RLS policies, views, triggers, and foreign key relations.",
    path: "codebase-maps/database-schema_26-08-18.md",
    highlights: [
      "Core Entities: employees, sites, shifts, breakdowns, safety_incidents, production_logs, telemetry_streams",
      "Strict 100% RLS enforcement with tenant separation",
      "Read replica routing for analytics and heavy shift reporting queries",
    ],
    status: "Verified & Active",
  },
  {
    id: "cicd-pipeline",
    title: "CI/CD Pipeline & Quality Gate Topology",
    category: "Codebase Maps",
    icon: GitBranch,
    summary:
      "Comprehensive mapping of the 11 parallel jobs in GitHub Actions CI, security audits, Docker staging, and deploy-rollback pipelines.",
    path: "codebase-maps/ci-cd-pipeline_26-08-18.md",
    highlights: [
      "pnpm quality gate: lint, type-check, test, tokens, styles, spelling, syncpack, knip, policy, rls, design",
      "Automated self-healing CI runner (nx fix-ci) and Trivy container vulnerability scanning",
      "Zero-downtime blue/green deployment pipeline via scripts/deploy.sh",
    ],
    status: "Verified & Active",
  },
  {
    id: "tech-stack-map",
    title: "Technology Stack & Catalog Map",
    category: "Codebase Maps",
    icon: Layers,
    summary:
      "Inventory of all workspace dependencies, runtime engines, Next.js 16, React 19, Supabase, Redis, and Playwright configurations.",
    path: "codebase-maps/technology-stack_26-08-18.md",
    highlights: [
      "Monorepo: Nx 22 + pnpm 9.15.9 workspace catalog",
      "Design System: Light-only OKLCH CSS tokens (--arch0 to --arch15)",
      "Infrastructure: Supabase PostgreSQL, Redis Cluster, Cloudflare Zero-Trust Tunnels",
    ],
    status: "Verified & Active",
  },
  {
    id: "system-wiki-control",
    title: "Control Room Operations Wiki",
    category: "System Wiki",
    icon: FileText,
    summary:
      "Standard Operating Procedures (SOPs), real-time alarm escalation workflows, and shift closeout handover protocols for control room operators.",
    path: "system-wiki/control-room-department.md",
    highlights: [
      "Telemetry telemetry thresholds: SCADA warning (<60s ack), critical (<30s ack)",
      "Shift handover verification checklist and supervisor digital sign-off",
      "Incident logging and automatic Inngest background event dispatch",
    ],
    status: "Synchronized",
  },
  {
    id: "system-wiki-tokens",
    title: "Design System & Glass Tokens Wiki",
    category: "System Wiki",
    icon: Layers,
    summary:
      "Definitive visual contract for macOS Sonoma inspired industrial glass surfaces, named diffusion shadows, and strictly light-only styling.",
    path: "system-wiki/design-system-glass-tokens.md",
    highlights: [
      "Glass surface classes: bg-white/70 backdrop-blur-xl border border-black/[0.08]",
      "Forbidden cliché design tropes strictly audited by tools/design-audit.cjs",
      "Animation easing constraints: cubic-bezier(0.16, 1, 0.3, 1)",
    ],
    status: "Synchronized",
  },
  {
    id: "agentic-wiki-mcp",
    title: "Agentic MCP Environment & Protocols",
    category: "Agentic Wiki",
    icon: Cpu,
    summary:
      "Specification of autonomous agent protocols, MCP tool configurations, token optimization mandates, and multi-perspective critique councils.",
    path: "agentic-system-wiki/mcp-environment-state.md",
    highlights: [
      "Active MCP Servers: codebase-memory, next-devtools, nx-mcp, postgres, context7, knowledge-rail",
      "4-Agent Critique Council scoring threshold (Angle 1-4 >= 98%)",
      "Mandatory token metrics reporting and prefix cache optimization",
    ],
    status: "Verified & Active",
  },
  {
    id: "core-agents-spec",
    title: "Agent Contract & Onboarding Index",
    category: "Core Specs",
    icon: Terminal,
    summary:
      "Non-negotiable developer and AI pair programming contract, command registry, quality gates, and git conventions.",
    path: "docs/AGENTS.md",
    highlights: [
      "AGENT_TRACER.md workflow trace update on every change",
      "Strict prohibition of mocks, stubs, or unresolved TODOs in production",
      "One commit per task with strict commitlint validation",
    ],
    status: "Verified & Active",
  },
];

export default function DocumentationMaps() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocItem>(DOCS_CATALOG[0]!);

  const categories = ["All", "Codebase Maps", "System Wiki", "Agentic Wiki", "Core Specs"];

  const filteredDocs = DOCS_CATALOG.filter((doc) => {
    const matchesCat = selectedCategory === "All" || doc.category === selectedCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.path.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#171717] border border-[#363636] rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#3ecf8e]" />
              <h2 className="text-lg font-semibold text-[#fafafa]">System Wiki & Codebase Maps</h2>
            </div>
            <p className="text-xs text-[#898989] mt-1">
              Authoritative architectural documentation, system topology maps, and operational
              guides for Arch-Systems.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-[#242424] border border-[#363636] rounded-full text-xs font-mono text-[#3ecf8e] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> 8 Documents Indexed
            </span>
            <span className="px-3 py-1 bg-[#242424] border border-[#363636] rounded-full text-xs font-mono text-[#fafafa] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3ecf8e]" /> 100% Policy Verified
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#171717] border border-[#363636] p-1 rounded-lg overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-[#242424] text-[#3ecf8e] shadow-sm"
                  : "text-[#898989] hover:text-[#fafafa]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#898989] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation & maps..."
            className="w-full bg-[#171717] border border-[#363636] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#898989] focus:outline-none focus:border-[#3ecf8e]"
          />
        </div>
      </div>

      {/* Main Grid: Docs List + Detail Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document Cards List */}
        <div className="lg:col-span-5 space-y-3">
          {filteredDocs.map((doc) => {
            const Icon = doc.icon;
            const isSelected = selectedDoc.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? "bg-[#242424] border-[#3ecf8e] shadow-lg shadow-[#3ecf8e]/5"
                    : "bg-[#171717] border-[#363636] hover:border-[#4d4d4d]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${isSelected ? "bg-[#3ecf8e]/10 text-[#3ecf8e]" : "bg-[#242424] text-[#898989]"}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-[#fafafa]">{doc.title}</h3>
                      <span className="text-[10px] text-[#898989] font-mono">{doc.category}</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#242424] border border-[#363636] text-[#3ecf8e] font-mono">
                    {doc.status}
                  </span>
                </div>
                <p className="text-xs text-[#b4b4b4] mt-2.5 line-clamp-2">{doc.summary}</p>
                <div className="mt-3 pt-2.5 border-t border-[#363636] flex items-center justify-between text-[10px] text-[#898989] font-mono">
                  <span>{doc.path}</span>
                  <span className="text-[#3ecf8e]">View Details →</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Document Detailed View */}
        <div className="lg:col-span-7">
          <div className="bg-[#171717] border border-[#363636] rounded-xl p-6 sticky top-24 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-[#363636] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#3ecf8e]/10 text-[#3ecf8e] font-mono font-medium">
                    {selectedDoc.category}
                  </span>
                  <span className="text-[10px] text-[#898989] font-mono">ID: {selectedDoc.id}</span>
                </div>
                <h3 className="text-base font-semibold text-[#fafafa] mt-1.5">
                  {selectedDoc.title}
                </h3>
                <p className="text-xs text-[#898989] font-mono mt-0.5">{selectedDoc.path}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#242424] text-[#3ecf8e] border border-[#363636]">
                <selectedDoc.icon className="w-5 h-5" />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-[#b4b4b4] uppercase tracking-wider">
                Executive Overview
              </h4>
              <p className="text-xs text-[#e1e1e1] leading-relaxed mt-2 bg-[#242424]/60 p-3.5 rounded-lg border border-[#363636]">
                {selectedDoc.summary}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-medium text-[#b4b4b4] uppercase tracking-wider">
                Key Architectural Invariants & Rules
              </h4>
              <ul className="mt-2.5 space-y-2">
                {selectedDoc.highlights.map((highlight, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-[#e1e1e1] bg-[#242424]/40 p-2.5 rounded-lg border border-[#363636]/60"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] mt-1.5 shrink-0" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t border-[#363636] flex items-center justify-between">
              <span className="text-xs text-[#898989]">
                Source: Root Monorepo Architecture Index
              </span>
              <span className="text-xs font-mono text-[#3ecf8e] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Fully Synchronized
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
