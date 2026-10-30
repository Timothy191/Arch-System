export interface AgentTaskLog {
  id: string;
  timestamp: string;
  agent: string;
  role: string;
  action: string;
  tokensUsed: number;
  tokensCached: number;
  zarCost: number;
  status: 'Completed' | 'Verified' | 'Optimized';
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

export const AGENT_SYSTEM_BREAKDOWN: AgentBreakdown[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    category: 'Primary Orchestrator & Multi-File Architecture',
    tokensSpent: '8.55M',
    tokensCached: '29.40M',
    zarCost: 2250.0,
    usdCost: 121.49,
    percentage: 45.0,
    color: '#d97706', // Industrial Gold / Amber
    model: 'Claude 3.7 Sonnet / Claude 3.5 Sonnet',
    pricingNote: '$3.00/M in (R55.56) • $0.30/M cache read (R5.56) • $15.00/M out (R277.80)',
    description:
      'Orchestrates multi-file refactoring, agentic subagent dispatch, quality gates, and code-review passes with 90% prompt caching discounts.',
  },
  {
    id: 'antigravity',
    name: 'Google Antigravity (AGY 2.0)',
    category: 'Cognitive Architecture & 4-Agent Critique Council',
    tokensSpent: '5.70M',
    tokensCached: '18.60M',
    zarCost: 1500.0,
    usdCost: 80.99,
    percentage: 30.0,
    color: '#059669', // Emerald
    model: 'Gemini 2.5 Pro / Flash & AGY Subagents',
    pricingNote: 'High prefix cache hit ratio (90.0%) with surgical line slicing',
    description:
      'Deep reasoning engine, first-principles systems validation, 4-agent critique council audits, and automated Playwright video generation.',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot / LSP',
    category: 'Inline Code Completion & Language Server',
    tokensSpent: '2.28M',
    tokensCached: '4.50M',
    zarCost: 600.0,
    usdCost: 32.4,
    percentage: 12.0,
    color: '#0284c7', // Ocean Blue
    model: 'Copilot GPT-4o / Claude 3.5 Sonnet Inline',
    pricingNote: 'Flat subscription allocation & low-latency IDE streaming',
    description:
      'Real-time tab completions, TypeScript interface expansion, inline docstring generation, and syntax scaffolding.',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local / Self-Hosted)',
    category: 'Edge Computing & Local Offline Models',
    tokensSpent: '1.52M',
    tokensCached: '0.00M',
    zarCost: 0.0,
    usdCost: 0.0,
    percentage: 8.0,
    color: '#7c3aed', // Violet
    model: 'DeepSeek-Coder 33B / Llama 3 8B (Local)',
    pricingNote: '100% Free / Self-Hosted on Local Mining Edge Hardware',
    description:
      'Zero API cost offline processing, SCADA protocol translation testing, edge sensor simulation, and local embeddings.',
  },
  {
    id: 'subagents',
    name: 'Devin / Cursor / OpenCode',
    category: 'Autonomous Specialized Runners & Tools',
    tokensSpent: '0.95M',
    tokensCached: '6.50M',
    zarCost: 650.0,
    usdCost: 35.1,
    percentage: 5.0,
    color: '#e11d48', // Crimson Rose
    model: 'Claude 3.5 Haiku / Sonnet Dedicated',
    pricingNote: 'Scoped branch work & targeted dead-code pruning loops',
    description:
      'Autonomous task-specific runner pipelines for dead code pruning (Knip), database migration validation, and cspell dictionary maintenance.',
  },
];

export const PROJECT_MILESTONES: MilestoneSpend[] = [
  {
    period: 'Weeks 1–2',
    dateRange: 'Jun 15 – Jun 28, 2026',
    milestone: 'Monorepo Foundation, Design Tokens & Database Core',
    tokensUsed: '3.24M',
    tokensCached: '9.60M',
    usdCost: 45.9,
    zarCost: 850.0,
    zarSaved: 2510.0,
    commits: 18,
    bugsFixed: 14,
  },
  {
    period: 'Weeks 3–4',
    dateRange: 'Jun 29 – Jul 12, 2026',
    milestone: 'Portal Shell, Supabase RLS Migration & Auth Architecture',
    tokensUsed: '4.38M',
    tokensCached: '13.20M',
    usdCost: 60.48,
    zarCost: 1120.0,
    zarSaved: 3450.0,
    commits: 22,
    bugsFixed: 19,
  },
  {
    period: 'Weeks 5–6',
    dateRange: 'Jul 13 – Jul 26, 2026',
    milestone: '8 Mining Department Dashboards, SCADA & IoT Telemetry',
    tokensUsed: '4.82M',
    tokensCached: '14.50M',
    usdCost: 66.95,
    zarCost: 1240.0,
    zarSaved: 3820.0,
    commits: 16,
    bugsFixed: 17,
  },
  {
    period: 'Weeks 7–8',
    dateRange: 'Jul 27 – Aug 9, 2026',
    milestone: 'Redis Caching, L1/L2 Write-Through, Supabase SSR Clients & Inngest',
    tokensUsed: '3.66M',
    tokensCached: '11.20M',
    usdCost: 51.84,
    zarCost: 960.0,
    zarSaved: 2940.0,
    commits: 12,
    bugsFixed: 9,
  },
  {
    period: 'Weeks 9–10',
    dateRange: 'Aug 10 – Aug 24, 2026',
    milestone: 'Motion Standard (Framer Motion), Asset Compression & Drift Health Index (DHI)',
    tokensUsed: '2.56M',
    tokensCached: '7.14M',
    usdCost: 37.21,
    zarCost: 689.31,
    zarSaved: 1624.2,
    commits: 14,
    bugsFixed: 12,
  },
  {
    period: 'Week 11 (Current)',
    dateRange: 'Aug 25 – Sep 2, 2026',
    milestone:
      'Pre-Flight Research Gate, CMS Decommissioning, React Flow Overview Consolidation & 8-Agent Hierarchy',
    tokensUsed: '1.92M',
    tokensCached: '18.40M',
    usdCost: 24.8,
    zarCost: 458.8,
    zarSaved: 3820.5,
    commits: 18,
    bugsFixed: 15,
  },
];

export const AGENT_TASK_FEED: AgentTaskLog[] = [
  {
    id: 'TASK-001',
    timestamp: '17:13 - 17:14',
    agent: 'Claude Code',
    role: 'Production Environment Engineer',
    action: 'Refactor setup-production-environment.sh & .env templates',
    tokensUsed: 3100,
    tokensCached: 52000,
    zarCost: 0.44,
    status: 'Completed',
    details:
      'Fixed unbound VERSION_ID error on Arch Linux; updated localhost fallback environment defaults.',
  },
  {
    id: 'TASK-002',
    timestamp: '17:15 - 17:18',
    agent: 'Subagent (Knip)',
    role: 'Dead-Code Pruner',
    action: 'Automated Dead Code Removal & Spelling Dictionary Fix',
    tokensUsed: 2700,
    tokensCached: 52000,
    zarCost: 0.38,
    status: 'Optimized',
    details:
      'Pruned 8 unused exports and 4 unused types; added opencode and autoplay to cspell.json.',
  },
  {
    id: 'TASK-003',
    timestamp: '17:22 - 17:33',
    agent: 'Claude Code',
    role: 'Subagent 316790df (Portal Simplifier)',
    action: 'Flatten Component Trees in apps/portal/app/',
    tokensUsed: 18125,
    tokensCached: 58250,
    zarCost: 2.56,
    status: 'Optimized',
    details:
      'Flattened login DOM wrappers, replaced raw SVGs with lucide-react icons, and cleaned DelayEntriesForm.',
  },
  {
    id: 'TASK-004',
    timestamp: '17:25 - 17:34',
    agent: 'Claude Code',
    role: 'Subagent a1d857e2 (Departments Simplifier)',
    action: 'Optimize apps/portal/features/departments/',
    tokensUsed: 14500,
    tokensCached: 62000,
    zarCost: 2.05,
    status: 'Optimized',
    details:
      'Parallelized Supabase queries in SafetyDashboard (Promise.all), fixed dynamic Tailwind JIT classes in SafetyCharts.',
  },
  {
    id: 'TASK-005',
    timestamp: '17:38 - 17:45',
    agent: 'Claude Code',
    role: 'Subagent 39003d21 (Libs Features Engine)',
    action: 'Refactor libs/features/ query paths & tab lookups',
    tokensUsed: 18500,
    tokensCached: 42000,
    zarCost: 2.62,
    status: 'Optimized',
    details:
      'Flattened 8-branch department tabs to DEPARTMENT_TABS_MAP, single-pass forecast loop, and cached hero rotator.',
  },
  {
    id: 'TASK-006',
    timestamp: '17:54 - 18:01',
    agent: 'Antigravity',
    role: 'System Integration Engineer',
    action: 'Integrate Cloudflare Workflows & Zero-Trust Infra',
    tokensUsed: 4200,
    tokensCached: 64000,
    zarCost: 0.59,
    status: 'Verified',
    details:
      'Integrated apps/cloudflare-workflows with Jest CommonJS SWC transformers and synced fuxa-tunnel.yml.',
  },
  {
    id: 'TASK-007',
    timestamp: '18:18 - 18:25',
    agent: 'Antigravity',
    role: 'Architecture Media Producer',
    action: 'Automated HD Video Walkthrough Generation (Playwright + FFmpeg)',
    tokensUsed: 6400,
    tokensCached: 82000,
    zarCost: 0.91,
    status: 'Completed',
    details:
      'Rendered 1080p Executive Briefing and Technical Deep-Dive video walkthroughs in docs/videos/.',
  },
  {
    id: 'TASK-008',
    timestamp: '10:44 - 10:46',
    agent: 'Antigravity',
    role: 'Audit Suite Architect',
    action: 'Audit Suite Restructuring & Versioned Log Generation',
    tokensUsed: 3950,
    tokensCached: 28400,
    zarCost: 0.54,
    status: 'Completed',
    details:
      'Created tools/run-audit.cjs orchestrator, outputting versioned log-N(YY-MM-DD) folders containing results.md, required-actions.md, design-report.md, and rls-report.md.',
  },
  {
    id: 'TASK-009',
    timestamp: '10:46 - 10:48',
    agent: 'Antigravity',
    role: 'Portal Dashboard Engineer',
    action: 'System Overview Department Card & Overview Page Route',
    tokensUsed: 2800,
    tokensCached: 32200,
    zarCost: 0.39,
    status: 'Completed',
    details:
      'Added System Overview department card to Hub dashboard, built /overview page route in portal, and wired /api/audit endpoints for report viewing.',
  },
  {
    id: 'TASK-010',
    timestamp: '10:52 - 10:54',
    agent: 'Antigravity',
    role: 'Codebase Maps Automation Engineer',
    action: 'Automated Codebase Maps Generator & Manifest Indexer',
    tokensUsed: 2400,
    tokensCached: 35800,
    zarCost: 0.33,
    status: 'Completed',
    details:
      'Built tools/generate-codebase-maps.cjs, versioned codebase-maps/log-N(YY-MM-DD)/ folders, manifest.json metadata index, and /api/codebase-maps route.',
  },
  {
    id: 'TASK-011',
    timestamp: '10:55 - 10:57',
    agent: 'Antigravity',
    role: 'Telemetry & Performance Analyst',
    action: 'Monitoring Dashboard Model Telemetry & ZAR Cost Update',
    tokensUsed: 2100,
    tokensCached: 38500,
    zarCost: 0.29,
    status: 'Completed',
    details:
      'Updated AgenticMonitor dashboard with latest model metrics (Gemini 3.6 Flash / Claude 3.7), token cache hit ratios, coding time, and ZAR expenditure.',
  },
  {
    id: 'TASK-012',
    timestamp: '08:45 - 08:50',
    agent: 'Antigravity',
    role: 'Full-Stack Operations Architect',
    action: 'Promote Availability & Utilization to Dedicated Department Route',
    tokensUsed: 4200,
    tokensCached: 68500,
    zarCost: 0.58,
    status: 'Verified',
    details:
      'Registered /availability-utilization as a first-class department route with 30-Day Activity Ledger, monthly summaries, and executive boardroom exports.',
  },
  {
    id: 'TASK-013',
    timestamp: '09:25 - 09:30',
    agent: 'Antigravity',
    role: 'Next.js 16 Performance Architect',
    action: 'Next.js 16 Client Responsiveness & Partial Prefetching Optimization',
    tokensUsed: 3800,
    tokensCached: 74200,
    zarCost: 0.52,
    status: 'Optimized',
    details:
      'Enabled LazyMotion domAnimation dynamic streaming, IBM Plex Sans font preloading, and BottomNav route prefetching for instant page transitions.',
  },
  {
    id: 'TASK-014',
    timestamp: '10:35 - 10:40',
    agent: 'Antigravity',
    role: 'Industrial Resiliency Specialist',
    action: 'Circuit Breaker & Autonomous Retry Error Pipeline Integration',
    tokensUsed: 4600,
    tokensCached: 82000,
    zarCost: 0.64,
    status: 'Verified',
    details:
      'Integrated exponential backoff retry-strategy and 3-state CircuitBreaker into ErrorBoundary component and React Query dashboard telemetry.',
  },
];

// All-Time Project Metrics (Day 1 - Today / 11 Weeks)
export const LIFETIME_METRICS = {
  tokensUsed: 19000000,
  tokensCached: 59000000,
  tokensReused: 53100000,
  tokensSaved: 18240000,
  usdCost: 269.98,
  zarCost: 5000.0,
  zarSaved: 15000.0,
  codingTime: '150h',
  totalCommits: 99,
  bugsFixed: 75,
  qualityGateRuns: 195,
  cacheHitRatio: 90,
};

// Current Session Metrics (Aug 20, 2026)
export const SESSION_METRICS = {
  tokensUsed: 245600,
  tokensCached: 842000,
  tokensReused: 798000,
  tokensSaved: 412000,
  usdCost: 1.82,
  zarCost: 33.71,
  zarSaved: 64.2,
  codingTime: '5h 15m',
  totalCommits: 14,
  bugsFixed: 12,
  qualityGateRuns: 7,
  cacheHitRatio: 92.4,
};
