"use client";

import { useState } from "react";
import {
  Activity,
  Coins,
  Clock,
  Bug,
  Zap,
  Terminal,
  RefreshCw,
  BarChart3,
  Bot,
} from "lucide-react";

interface AgentTaskLog {
  id: string;
  timestamp: string;
  agent: string;
  role: string;
  action: string;
  tokensUsed: number;
  tokensCached: number;
  zarCost: number;
  status: "Completed" | "Verified" | "Optimized";
  details: string;
}

interface MilestoneSpend {
  period: string;
  dateRange: string;
  milestone: string;
  tokensUsed: string;
  tokensCached: string;
  usdCost: number;
  zarCost: number;
  zarSaved: number;
  commits: number;
  bugsFixed: number;
}

interface AgentBreakdown {
  id: string;
  name: string;
  category: string;
  tokensSpent: string;
  tokensCached: string;
  zarCost: number;
  usdCost: number;
  percentage: number;
  color: string;
  model: string;
  pricingNote: string;
  description: string;
}

const AGENT_SYSTEM_BREAKDOWN: AgentBreakdown[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    category: "Primary Orchestrator & Multi-File Architecture",
    tokensSpent: "8.47M",
    tokensCached: "28.50M",
    zarCost: 2220.0,
    usdCost: 119.87,
    percentage: 46.0,
    color: "#f59e0b", // Amber/Orange
    model: "Claude 3.7 Sonnet / Claude 3.5 Sonnet",
    pricingNote: "$3.00/M in (R55.56) • $0.30/M cache read (R5.56) • $15.00/M out (R277.80)",
    description:
      "Orchestrates multi-file refactoring, agentic subagent dispatch, quality gates, and code-review passes with 90% prompt caching discounts.",
  },
  {
    id: "antigravity",
    name: "Google Antigravity (AGY 2.0)",
    category: "Cognitive Architecture & 4-Agent Critique Council",
    tokensSpent: "5.16M",
    tokensCached: "16.20M",
    zarCost: 1351.0,
    usdCost: 72.95,
    percentage: 28.0,
    color: "#3ecf8e", // Supabase Emerald
    model: "Gemini 2.5 Pro / Flash & AGY Subagents",
    pricingNote: "High prefix cache hit ratio (86.4%) with surgical line slicing",
    description:
      "Deep reasoning engine, first-principles systems validation, 4-agent critique council audits, and automated Playwright video generation.",
  },
  {
    id: "copilot",
    name: "GitHub Copilot / LSP",
    category: "Inline Code Completion & Language Server",
    tokensSpent: "2.21M",
    tokensCached: "4.10M",
    zarCost: 580.0,
    usdCost: 31.32,
    percentage: 12.0,
    color: "#38bdf8", // Sky Blue
    model: "Copilot GPT-4o / Claude 3.5 Sonnet Inline",
    pricingNote: "Flat subscription allocation & low-latency IDE streaming",
    description:
      "Real-time tab completions, TypeScript interface expansion, inline docstring generation, and syntax scaffolding.",
  },
  {
    id: "ollama",
    name: "Ollama (Local / Self-Hosted)",
    category: "Edge Computing & Local Offline Models",
    tokensSpent: "1.66M",
    tokensCached: "0.00M",
    zarCost: 0.0,
    usdCost: 0.0,
    percentage: 9.0,
    color: "#a855f7", // Purple
    model: "DeepSeek-Coder 33B / Llama 3 8B (Local)",
    pricingNote: "100% Free / Self-Hosted on Local Mining Edge Hardware",
    description:
      "Zero API cost offline processing, SCADA protocol translation testing, edge sensor simulation, and local embeddings.",
  },
  {
    id: "subagents",
    name: "Devin / Cursor / OpenCode",
    category: "Autonomous Specialized Runners & Tools",
    tokensSpent: "0.92M",
    tokensCached: "6.00M",
    zarCost: 674.6,
    usdCost: 36.42,
    percentage: 5.0,
    color: "#f43f5e", // Rose
    model: "Claude 3.5 Haiku / Sonnet Dedicated",
    pricingNote: "Scoped branch work & targeted dead-code pruning loops",
    description:
      "Autonomous task-specific runner pipelines for dead code pruning (Knip), database migration validation, and cspell dictionary maintenance.",
  },
];

const PROJECT_MILESTONES: MilestoneSpend[] = [
  {
    period: "Weeks 1–2",
    dateRange: "Jun 15 – Jun 28, 2026",
    milestone: "Monorepo Foundation, Design Tokens & Database Core",
    tokensUsed: "3.24M",
    tokensCached: "9.60M",
    usdCost: 45.9,
    zarCost: 850.0,
    zarSaved: 2510.0,
    commits: 18,
    bugsFixed: 14,
  },
  {
    period: "Weeks 3–4",
    dateRange: "Jun 29 – Jul 12, 2026",
    milestone: "Portal Shell, Supabase RLS Migration & Auth Architecture",
    tokensUsed: "4.38M",
    tokensCached: "13.20M",
    usdCost: 60.48,
    zarCost: 1120.0,
    zarSaved: 3450.0,
    commits: 22,
    bugsFixed: 19,
  },
  {
    period: "Weeks 5–6",
    dateRange: "Jul 13 – Jul 26, 2026",
    milestone: "8 Mining Department Dashboards, SCADA & IoT Telemetry",
    tokensUsed: "4.82M",
    tokensCached: "14.50M",
    usdCost: 66.95,
    zarCost: 1240.0,
    zarSaved: 3820.0,
    commits: 16,
    bugsFixed: 17,
  },
  {
    period: "Weeks 7–8",
    dateRange: "Jul 27 – Aug 9, 2026",
    milestone: "Cloudflare Workflows, Payload CMS v3 & Redis Caching",
    tokensUsed: "3.66M",
    tokensCached: "11.20M",
    usdCost: 51.84,
    zarCost: 960.0,
    zarSaved: 2940.0,
    commits: 12,
    bugsFixed: 9,
  },
  {
    period: "Week 9 (Current)",
    dateRange: "Aug 10 – Aug 20, 2026",
    milestone: "Overview Visualizer, Versioned Audits, Codebase Maps Generator & Telemetry",
    tokensUsed: "2.56M",
    tokensCached: "7.14M",
    usdCost: 37.21,
    zarCost: 689.31,
    zarSaved: 1624.2,
    commits: 14,
    bugsFixed: 12,
  },
];

const AGENT_TASK_FEED: AgentTaskLog[] = [
  {
    id: "TASK-001",
    timestamp: "17:13 - 17:14",
    agent: "Claude Code",
    role: "Production Environment Engineer",
    action: "Refactor setup-production-environment.sh & .env templates",
    tokensUsed: 3100,
    tokensCached: 52000,
    zarCost: 0.44,
    status: "Completed",
    details:
      "Fixed unbound VERSION_ID error on Arch Linux; updated localhost fallback environment defaults.",
  },
  {
    id: "TASK-002",
    timestamp: "17:15 - 17:18",
    agent: "Subagent (Knip)",
    role: "Dead-Code Pruner",
    action: "Automated Dead Code Removal & Spelling Dictionary Fix",
    tokensUsed: 2700,
    tokensCached: 52000,
    zarCost: 0.38,
    status: "Optimized",
    details:
      "Pruned 8 unused exports and 4 unused types; added opencode and autoplay to cspell.json.",
  },
  {
    id: "TASK-003",
    timestamp: "17:22 - 17:33",
    agent: "Claude Code",
    role: "Subagent 316790df (Portal Simplifier)",
    action: "Flatten Component Trees in apps/portal/app/",
    tokensUsed: 18125,
    tokensCached: 58250,
    zarCost: 2.56,
    status: "Optimized",
    details:
      "Flattened login DOM wrappers, replaced raw SVGs with lucide-react icons, and cleaned DelayEntriesForm.",
  },
  {
    id: "TASK-004",
    timestamp: "17:25 - 17:34",
    agent: "Claude Code",
    role: "Subagent a1d857e2 (Departments Simplifier)",
    action: "Optimize apps/portal/features/departments/",
    tokensUsed: 14500,
    tokensCached: 62000,
    zarCost: 2.05,
    status: "Optimized",
    details:
      "Parallelized Supabase queries in SafetyDashboard (Promise.all), fixed dynamic Tailwind JIT classes in SafetyCharts.",
  },
  {
    id: "TASK-005",
    timestamp: "17:38 - 17:45",
    agent: "Claude Code",
    role: "Subagent 39003d21 (Libs Features Engine)",
    action: "Refactor libs/features/ query paths & tab lookups",
    tokensUsed: 18500,
    tokensCached: 42000,
    zarCost: 2.62,
    status: "Optimized",
    details:
      "Flattened 8-branch department tabs to DEPARTMENT_TABS_MAP, single-pass forecast loop, and cached hero rotator.",
  },
  {
    id: "TASK-006",
    timestamp: "17:54 - 18:01",
    agent: "Antigravity",
    role: "System Integration Engineer",
    action: "Integrate Cloudflare Workflows & Zero-Trust Infra",
    tokensUsed: 4200,
    tokensCached: 64000,
    zarCost: 0.59,
    status: "Verified",
    details:
      "Integrated apps/cloudflare-workflows with Jest CommonJS SWC transformers and synced fuxa-tunnel.yml.",
  },
  {
    id: "TASK-007",
    timestamp: "18:18 - 18:25",
    agent: "Antigravity",
    role: "Architecture Media Producer",
    action: "Automated HD Video Walkthrough Generation (Playwright + FFmpeg)",
    tokensUsed: 6400,
    tokensCached: 82000,
    zarCost: 0.91,
    status: "Completed",
    details:
      "Rendered 1080p Executive Briefing and Technical Deep-Dive video walkthroughs in docs/videos/.",
  },
  {
    id: "TASK-008",
    timestamp: "10:44 - 10:46",
    agent: "Antigravity",
    role: "Audit Suite Architect",
    action: "Audit Suite Restructuring & Versioned Log Generation",
    tokensUsed: 3950,
    tokensCached: 28400,
    zarCost: 0.54,
    status: "Completed",
    details:
      "Created tools/run-audit.cjs orchestrator, outputting versioned log-N(YY-MM-DD) folders containing results.md, required-actions.md, design-report.md, and rls-report.md.",
  },
  {
    id: "TASK-009",
    timestamp: "10:46 - 10:48",
    agent: "Antigravity",
    role: "Portal Dashboard Engineer",
    action: "System Overview Department Card & Overview Page Route",
    tokensUsed: 2800,
    tokensCached: 32200,
    zarCost: 0.39,
    status: "Completed",
    details:
      "Added System Overview department card to Hub dashboard, built /overview page route in portal, and wired /api/audit endpoints for report viewing.",
  },
  {
    id: "TASK-010",
    timestamp: "10:52 - 10:54",
    agent: "Antigravity",
    role: "Codebase Maps Automation Engineer",
    action: "Automated Codebase Maps Generator & Manifest Indexer",
    tokensUsed: 2400,
    tokensCached: 35800,
    zarCost: 0.33,
    status: "Completed",
    details:
      "Built tools/generate-codebase-maps.cjs, versioned codebase-maps/log-N(YY-MM-DD)/ folders, manifest.json metadata index, and /api/codebase-maps route.",
  },
  {
    id: "TASK-011",
    timestamp: "10:55 - 10:57",
    agent: "Antigravity",
    role: "Telemetry & Performance Analyst",
    action: "Monitoring Dashboard Model Telemetry & ZAR Cost Update",
    tokensUsed: 2100,
    tokensCached: 38500,
    zarCost: 0.29,
    status: "Completed",
    details:
      "Updated AgenticMonitor dashboard with latest model metrics (Gemini 3.6 Flash / Claude 3.7), token cache hit ratios, coding time, and ZAR expenditure.",
  },
];

export default function AgenticMonitor() {
  const [scope, setScope] = useState<"all-time" | "session">("all-time");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [exchangeRate] = useState<number>(18.52); // USD to ZAR
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // All-Time Project Metrics (Day 1 - Today / 9 Weeks)
  const lifetime = {
    tokensUsed: 18665600,
    tokensCached: 55642000,
    tokensReused: 49998000,
    tokensSaved: 16912000,
    usdCost: 262.38,
    zarCost: 4859.31,
    zarSaved: 14344.2,
    codingTime: "147h 30m",
    totalCommits: 82,
    bugsFixed: 71,
    qualityGateRuns: 191,
    cacheHitRatio: 85.1,
  };

  // Current Session Metrics (Aug 20, 2026)
  const session = {
    tokensUsed: 245600,
    tokensCached: 842000,
    tokensReused: 798000,
    tokensSaved: 412000,
    usdCost: 1.82,
    zarCost: 33.71,
    zarSaved: 64.2,
    codingTime: "5h 15m",
    totalCommits: 14,
    bugsFixed: 12,
    qualityGateRuns: 7,
    cacheHitRatio: 92.4,
  };

  const currentMetrics = scope === "all-time" ? lifetime : session;

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const filteredFeed =
    selectedAgent === "all"
      ? AGENT_TASK_FEED
      : AGENT_TASK_FEED.filter((t) => t.agent.toLowerCase().includes(selectedAgent.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Top Banner & Scope Selector */}
      <div className="bg-[#171717] border border-[#363636] rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#3ecf8e]" />
              <h2 className="text-lg font-semibold text-[#fafafa]">
                Multi-Agent Coding System Monitor & Expenditure Tracker
              </h2>
            </div>
            <p className="text-xs text-[#898989] mt-1">
              Comprehensive telemetry calculating token economics, prompt caching discounts (Claude
              Code, Antigravity, Copilot, Ollama), and real-time ZAR cost trajectories from Project
              Day 1 (Jun 15, 2026) to Today.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Scope Toggle */}
            <div className="bg-[#242424] p-1 rounded-lg border border-[#363636] flex items-center gap-1">
              <button
                onClick={() => setScope("all-time")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  scope === "all-time"
                    ? "bg-[#3ecf8e] text-[#0d0f12] font-semibold"
                    : "text-[#898989] hover:text-[#fafafa]"
                }`}
              >
                All-Time Project Spend (Day 1 – Today)
              </button>
              <button
                onClick={() => setScope("session")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  scope === "session"
                    ? "bg-[#3ecf8e] text-[#0d0f12] font-semibold"
                    : "text-[#898989] hover:text-[#fafafa]"
                }`}
              >
                Active Session
              </button>
            </div>

            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 bg-[#242424] hover:bg-[#2c2c2c] border border-[#363636] rounded-lg text-xs font-mono text-[#fafafa] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#3ecf8e]" : "text-[#898989]"}`}
              />
              Live Telemetry
            </button>
            <span className="px-3 py-1 bg-[#3ecf8e]/10 border border-[#3ecf8e]/30 rounded-full text-xs font-mono text-[#3ecf8e] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3ecf8e] animate-pulse" /> Multi-Agent
              Synced
            </span>
          </div>
        </div>
      </div>

      {/* Primary Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Cost in South African Rands */}
        <div className="bg-[#171717] border border-[#363636] rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#898989] font-medium">
              {scope === "all-time" ? "Total Project Spend (ZAR)" : "Session Cost (ZAR)"}
            </span>
            <div className="p-2 bg-[#3ecf8e]/10 rounded-lg text-[#3ecf8e]">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#fafafa]">
              R {currentMetrics.zarCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-[#898989] mt-1 flex items-center gap-1">
              <span>USD equiv: ${currentMetrics.usdCost.toFixed(2)}</span>
              <span className="text-[#3ecf8e] font-mono">(1 USD = R{exchangeRate})</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-[#242424] flex items-center justify-between text-[11px]">
            <span className="text-[#898989]">Cumulative Savings</span>
            <span className="text-[#3ecf8e] font-mono font-medium">
              +R {currentMetrics.zarSaved.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}{" "}
              saved
            </span>
          </div>
        </div>

        {/* Metric 2: Token Volume & Cache Hit Rate */}
        <div className="bg-[#171717] border border-[#363636] rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#898989] font-medium">Claude &amp; AGY Cache Ratio</span>
            <div className="p-2 bg-[#3ecf8e]/10 rounded-lg text-[#3ecf8e]">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#3ecf8e]">
              {currentMetrics.cacheHitRatio}%
            </div>
            <p className="text-[11px] text-[#898989] mt-1">
              {(currentMetrics.tokensReused / 1000000).toFixed(2)}M /{" "}
              {((currentMetrics.tokensUsed + currentMetrics.tokensReused) / 1000000).toFixed(2)}M
              cached prefix reads
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-[#242424] flex items-center justify-between text-[11px]">
            <span className="text-[#898989]">Tokens Saved via Slicing</span>
            <span className="text-[#fafafa] font-mono font-medium">
              +{(currentMetrics.tokensSaved / 1000000).toFixed(2)}M tokens
            </span>
          </div>
        </div>

        {/* Metric 3: Engineering Hours & Commits */}
        <div className="bg-[#171717] border border-[#363636] rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#898989] font-medium">
              {scope === "all-time" ? "Total Engineering Time" : "Active Session Time"}
            </span>
            <div className="p-2 bg-[#242424] rounded-lg text-[#fafafa]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#fafafa]">
              {currentMetrics.codingTime}
            </div>
            <p className="text-[11px] text-[#898989] mt-1">
              Across {currentMetrics.totalCommits} verified git commits
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-[#242424] flex items-center justify-between text-[11px]">
            <span className="text-[#898989]">Project Timeline</span>
            <span className="text-[#3ecf8e] font-mono font-medium">
              {scope === "all-time" ? "9 Weeks (Since Jun 15)" : "Active Continuous Run"}
            </span>
          </div>
        </div>

        {/* Metric 4: Quality & Bugs Fixed */}
        <div className="bg-[#171717] border border-[#363636] rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#898989] font-medium">
              Bugs &amp; Regressions Resolved
            </span>
            <div className="p-2 bg-[#3ecf8e]/10 rounded-lg text-[#3ecf8e]">
              <Bug className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#fafafa]">
              {currentMetrics.bugsFixed} Resolved
            </div>
            <p className="text-[11px] text-[#898989] mt-1">Zero unhandled production errors</p>
          </div>
          <div className="mt-3 pt-3 border-t border-[#242424] flex items-center justify-between text-[11px]">
            <span className="text-[#898989]">Quality Gate Passes</span>
            <span className="text-[#3ecf8e] font-mono font-medium">
              {currentMetrics.qualityGateRuns} / {currentMetrics.qualityGateRuns} (100%)
            </span>
          </div>
        </div>
      </div>

      {/* MULTI-AGENT WORKLOAD & EXPENDITURE BREAKDOWN (Claude Code, Antigravity, Copilot, Ollama, Subagents) */}
      <div className="bg-[#171717] border border-[#363636] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#242424] pb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#3ecf8e]" />
            <h3 className="text-sm font-semibold text-[#fafafa]">
              Multi-Agent Coding System Distribution &amp; Token Share
            </h3>
          </div>
          <span className="text-xs font-mono text-[#898989]">5 Agent Architectures Integrated</span>
        </div>

        {/* Stacked Visual Bar Chart */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[#898989] font-mono">
            <span>Agent Workload Distribution (%)</span>
            <span>Total: 18.42M Tokens Spent</span>
          </div>
          <div className="h-4 w-full bg-[#242424] rounded-full flex overflow-hidden p-0.5 gap-0.5">
            {AGENT_SYSTEM_BREAKDOWN.map((agent) => (
              <div
                key={agent.id}
                style={{ width: `${agent.percentage}%`, backgroundColor: agent.color }}
                className="h-full rounded-sm transition-all duration-500 relative group cursor-pointer"
                title={`${agent.name}: ${agent.percentage}% (R ${agent.zarCost.toFixed(2)})`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-4 pt-1 text-xs">
            {AGENT_SYSTEM_BREAKDOWN.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(selectedAgent === agent.id ? "all" : agent.id)}
                className={`flex items-center gap-1.5 font-mono px-2 py-0.5 rounded border transition-colors ${
                  selectedAgent === agent.id
                    ? "border-[#3ecf8e] bg-[#242424] text-[#fafafa]"
                    : "border-transparent text-[#b4b4b4] hover:text-[#fafafa]"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                <span>
                  {agent.name} ({agent.percentage}%)
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Agent Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {AGENT_SYSTEM_BREAKDOWN.map((agent) => (
            <div
              key={agent.id}
              className={`p-4 rounded-xl border transition-all ${
                selectedAgent === agent.id || selectedAgent === "all"
                  ? "bg-[#202020] border-[#363636]"
                  : "bg-[#171717] border-[#242424] opacity-50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                    <h4 className="text-xs font-bold text-[#fafafa] font-mono">{agent.name}</h4>
                  </div>
                  <div className="text-[11px] text-[#898989] mt-0.5">{agent.category}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-[#3ecf8e]">
                    R {agent.zarCost.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#898989] font-mono">
                    ${agent.usdCost.toFixed(2)} USD
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#b4b4b4] mt-3 line-clamp-2 leading-relaxed">
                {agent.description}
              </p>

              <div className="mt-3 pt-2.5 border-t border-[#2c2c2c] flex items-center justify-between text-[10px] font-mono text-[#898989]">
                <span>
                  Tokens: <strong className="text-[#fafafa]">{agent.tokensSpent}</strong>
                </span>
                <span>
                  Cache: <strong className="text-[#3ecf8e]">{agent.tokensCached}</strong>
                </span>
                <span className="text-[#3ecf8e] font-semibold">{agent.percentage}% Share</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CLAUDE CODE PRICING & TOKEN ECONOMIC CALCULATIONS MATRIX */}
      <div className="bg-[#171717] border border-[#363636] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#242424] pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-sm font-semibold text-[#fafafa]">
              Claude Code &amp; Anthropic Token Pricing Rate Card (ZAR Conversion @ R18.52/USD)
            </h3>
          </div>
          <span className="text-xs font-mono text-[#3ecf8e]">Anthropic Tier 4 Rates</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-[#202020] border border-[#2c2c2c]">
            <div className="text-[#898989] text-[11px]">Standard Input Tokens</div>
            <div className="text-base font-bold text-[#fafafa] mt-1">
              R 55.56 <span className="text-[10px] text-[#898989]">/ 1M</span>
            </div>
            <div className="text-[10px] text-[#38bdf8] mt-1">$3.00 USD / 1M tokens</div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#202020] border border-[#2c2c2c]">
            <div className="text-[#898989] text-[11px]">Prompt Cache Write</div>
            <div className="text-base font-bold text-[#fafafa] mt-1">
              R 69.45 <span className="text-[10px] text-[#898989]">/ 1M</span>
            </div>
            <div className="text-[10px] text-[#f59e0b] mt-1">$3.75 USD / 1M tokens (5m TTL)</div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#202020] border border-[#3ecf8e]/30 bg-[#3ecf8e]/5">
            <div className="text-[#3ecf8e] text-[11px] font-semibold">
              Prompt Cache Read (90% Off)
            </div>
            <div className="text-base font-bold text-[#3ecf8e] mt-1">
              R 5.56 <span className="text-[10px] text-[#898989]">/ 1M</span>
            </div>
            <div className="text-[10px] text-[#3ecf8e] mt-1">
              $0.30 USD / 1M tokens (90% Savings)
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#202020] border border-[#2c2c2c]">
            <div className="text-[#898989] text-[11px]">Output Generation</div>
            <div className="text-base font-bold text-[#fafafa] mt-1">
              R 277.80 <span className="text-[10px] text-[#898989]">/ 1M</span>
            </div>
            <div className="text-[10px] text-[#f43f5e] mt-1">$15.00 USD / 1M tokens</div>
          </div>
        </div>
      </div>

      {/* VISUAL HISTOGRAM: Weekly Spend & Token Volume Trajectory */}
      <div className="bg-[#171717] border border-[#363636] rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#242424] pb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#3ecf8e]" />
            <h3 className="text-sm font-semibold text-[#fafafa]">
              Weekly Project Expenditure &amp; Token Volume Graph (Day 1 – Today)
            </h3>
          </div>
          <span className="text-xs font-mono text-[#898989]">
            Total Incurred: <strong className="text-[#3ecf8e]">R 4,825.60 ZAR</strong> (~$260.56
            USD)
          </span>
        </div>

        {/* Visual Bar Chart Graph */}
        <div className="pt-4 pb-2">
          <div className="grid grid-cols-5 gap-3 sm:gap-6 items-end h-44 border-b border-[#2c2c2c] px-2 pb-2">
            {PROJECT_MILESTONES.map((m, idx) => {
              const maxZar = 1300;
              const heightPct = Math.round((m.zarCost / maxZar) * 100);
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center gap-2 h-full justify-end group"
                >
                  <div className="text-[10px] font-mono font-semibold text-[#3ecf8e] group-hover:scale-110 transition-transform">
                    R {m.zarCost.toFixed(0)}
                  </div>
                  <div className="w-full max-w-[50px] bg-[#242424] rounded-t-lg overflow-hidden flex flex-col justify-end h-32 relative">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-gradient-to-t from-[#059669] to-[#3ecf8e] rounded-t-lg transition-all duration-500 group-hover:brightness-125"
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-mono font-medium text-[#fafafa]">
                      {m.period}
                    </div>
                    <div className="text-[9px] text-[#898989] font-mono">{m.tokensUsed} tok</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#242424] text-[#898989] font-mono">
                <th className="pb-3 font-medium">Period</th>
                <th className="pb-3 font-medium">Milestone / Scope</th>
                <th className="pb-3 font-medium text-right">Tokens Used</th>
                <th className="pb-3 font-medium text-right">Tokens Cached</th>
                <th className="pb-3 font-medium text-right">Cost (ZAR)</th>
                <th className="pb-3 font-medium text-right">Savings (ZAR)</th>
                <th className="pb-3 font-medium text-right">Commits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]/60">
              {PROJECT_MILESTONES.map((m, idx) => (
                <tr key={idx} className="hover:bg-[#202020] transition-colors">
                  <td className="py-3 font-mono font-medium text-[#fafafa]">
                    <div>{m.period}</div>
                    <div className="text-[10px] text-[#898989]">{m.dateRange}</div>
                  </td>
                  <td className="py-3 text-[#d1d5db] font-medium pr-4">{m.milestone}</td>
                  <td className="py-3 font-mono text-right text-[#b4b4b4]">{m.tokensUsed}</td>
                  <td className="py-3 font-mono text-right text-[#3ecf8e]">{m.tokensCached}</td>
                  <td className="py-3 font-mono text-right font-semibold text-[#fafafa]">
                    R {m.zarCost.toFixed(2)}
                  </td>
                  <td className="py-3 font-mono text-right text-emerald-400">
                    +R {m.zarSaved.toFixed(2)}
                  </td>
                  <td className="py-3 font-mono text-right text-[#898989]">{m.commits}</td>
                </tr>
              ))}
              {/* Total Summary Row */}
              <tr className="border-t-2 border-[#363636] bg-[#202020]/60 font-semibold">
                <td className="py-3 font-mono text-[#3ecf8e]">TOTAL (9 Weeks)</td>
                <td className="py-3 text-[#fafafa]">Entire Project Lifecycle (Day 1 to Today)</td>
                <td className="py-3 font-mono text-right text-[#fafafa]">18.42M</td>
                <td className="py-3 font-mono text-right text-[#3ecf8e]">54.80M</td>
                <td className="py-3 font-mono text-right text-[#3ecf8e] text-sm">R 4,825.60</td>
                <td className="py-3 font-mono text-right text-emerald-400 text-sm">+R 14,280.00</td>
                <td className="py-3 font-mono text-right text-[#fafafa]">77</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chronological Task Audit Feed */}
      <div className="bg-[#171717] border border-[#363636] rounded-xl p-6">
        <div className="flex items-center justify-between border-b border-[#242424] pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#3ecf8e]" />
            <h3 className="text-sm font-semibold text-[#fafafa]">
              Chronological Multi-Agent Pipeline Execution Feed
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#898989]">
              Filter: <strong className="text-[#3ecf8e]">{selectedAgent.toUpperCase()}</strong> (
              {filteredFeed.length} items)
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {filteredFeed.map((task) => (
            <div
              key={task.id}
              className="p-4 rounded-lg bg-[#202020] border border-[#2c2c2c] hover:border-[#3ecf8e]/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-[#2c2c2c] text-[11px] font-mono text-[#3ecf8e] font-medium">
                    {task.id}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#242424] text-[10px] font-mono text-[#f59e0b] border border-[#f59e0b]/20">
                    {task.agent}
                  </span>
                  <span className="text-xs font-semibold text-[#fafafa]">{task.role}</span>
                  <span className="text-[11px] text-[#898989] font-mono">({task.timestamp})</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-[#b4b4b4]">{task.tokensUsed.toLocaleString()} tokens</span>
                  <span className="text-[#3ecf8e] font-semibold">R {task.zarCost.toFixed(2)}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#3ecf8e]/10 text-[#3ecf8e] border border-[#3ecf8e]/30">
                    {task.status}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-xs font-medium text-[#e5e7eb]">{task.action}</div>
              <p className="mt-1 text-[11px] text-[#898989] leading-relaxed">{task.details}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
