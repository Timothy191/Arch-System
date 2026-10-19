import { Badge } from '@repo/ui/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
import { TECH_STACK } from '../lib/data';

const categoryIcons: Record<string, string> = {
  Frontend: '🎨',
  Backend: '⚙️',
  'DevOps & Caching': '🚀',
  'Testing & Quality': '🧪',
  'Integration Tools': '🔗',
};

export default function TechStack() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-text-heading">Technology Stack</h2>
        <p className="text-text-secondary mt-1">
          Complete overview of technologies used in Arch Systems Enterprise OS
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {TECH_STACK.map((category) => (
          <Card key={category.category} className="overflow-hidden">
            {/* Category header with color */}
            <div className="h-1" style={{ backgroundColor: category.color }} />

            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${category.color}20` }}
                >
                  {categoryIcons[category.category] || '📦'}
                </div>
                <div>
                  <CardTitle className="text-lg" style={{ color: category.color }}>
                    {category.category}
                  </CardTitle>
                  <div className="text-xs text-text-muted mt-0.5">
                    {category.items.length} technologies
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-3">
                {category.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-start justify-between p-3 rounded-lg bg-bg-tertiary hover:bg-border-subtle transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-heading">{item.name}</span>
                        {item.version && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-default text-text-muted"
                          >
                            {item.version}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Core Architecture Diagram */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-text-heading mb-4">Architecture Overview</h3>
        <div className="glass-card p-6 rounded-xl">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Frontend Layer */}
            <div className="flex flex-col items-center">
              <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">Frontend</div>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-3 bg-accent-green/10 border border-accent-green/30 rounded-lg text-accent-green text-sm font-medium">
                  Next.js 16.3.8
                </div>
                <div className="px-4 py-3 bg-accent-green/10 border border-accent-green/30 rounded-lg text-accent-green text-sm font-medium">
                  React 19.2
                </div>
                <div className="px-4 py-3 bg-accent-green/10 border border-accent-green/30 rounded-lg text-accent-green text-sm font-medium">
                  Tailwind OKLCH
                </div>
              </div>
            </div>

            <div className="text-border-default text-2xl">→</div>

            {/* API Layer */}
            <div className="flex flex-col items-center">
              <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">
                RPC & Boundary
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg text-accent-blue text-sm font-medium">
                  Server Actions + @repo/contract
                </div>
                <div className="px-4 py-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg text-accent-blue text-sm font-medium">
                  @repo/supabase SSR
                </div>
              </div>
            </div>

            <div className="text-border-default text-2xl">→</div>

            {/* Backend Layer */}
            <div className="flex flex-col items-center">
              <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">
                Data & Cache
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg text-accent-blue text-sm font-medium">
                  PostgreSQL 17 (186 Migrations)
                </div>
                <div className="px-4 py-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg text-accent-blue text-sm font-medium">
                  100% RLS InitPlan
                </div>
                <div className="px-4 py-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg text-accent-blue text-sm font-medium">
                  Hybrid L1/L2 Redis 7.4
                </div>
              </div>
            </div>

            <div className="text-border-default text-2xl">+</div>

            {/* Integration Layer */}
            <div className="flex flex-col items-center">
              <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">
                Industrial Mesh
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-3 bg-accent-amber/10 border border-accent-amber/30 rounded-lg text-accent-amber text-sm font-medium">
                  FUXA SCADA
                </div>
                <div className="px-4 py-3 bg-accent-amber/10 border border-accent-amber/30 rounded-lg text-accent-amber text-sm font-medium">
                  Inngest
                </div>
                <div className="px-4 py-3 bg-accent-amber/10 border border-accent-amber/30 rounded-lg text-accent-amber text-sm font-medium">
                  Flowise & Langfuse
                </div>
              </div>
            </div>
          </div>

          {/* Data Flow */}
          <div className="mt-6 pt-6 border-t border-default">
            <div className="text-xs text-text-muted text-center">
              Data Flow: Operator → Next.js 16 Proxy → RSC / Server Action (@repo/contract) →
              @repo/supabase (Primary / Read Replica) → PostgreSQL 17 (100% RLS InitPlan) → Hybrid
              L1/L2 Cache
            </div>
          </div>
        </div>
      </div>

      {/* Monorepo Structure */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-text-heading mb-4">Monorepo Structure</h3>
        <div className="glass-card p-6 rounded-xl font-mono text-sm">
          <div className="text-text-secondary">
            <span className="text-accent-green">Arch-System/</span>
            <br />
            &nbsp;&nbsp;├── <span className="text-accent-blue">apps/</span>
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── <span className="text-accent-green">portal/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Next.js 16.3.8 App Router portal
            (8 Core Operational Modules)
            <br />
            &nbsp;&nbsp;├── <span className="text-accent-blue">libs/</span>
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── <span className="text-accent-green">features/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Domain libraries (departments, hub, auth,
            equipment)
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── <span className="text-accent-green">shared/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Shared data-access, circuit
            breakers & utilities
            <br />
            &nbsp;&nbsp;├── <span className="text-accent-blue">packages/</span>
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── <span className="text-accent-green">contract/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Canonical Zod schemas & API/DB drift
            contracts
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── <span className="text-accent-green">database/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# 186 Supabase PostgreSQL 17 migrations &
            generated types
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── <span className="text-accent-green">supabase/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# SSR auth, Primary & Read-Replica client
            boundary
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── <span className="text-accent-green">redis/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Hybrid L1 LRU + L2 Upstash
            REST cache & Redlock
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── <span className="text-accent-green">theme/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Semantic light-mode OKLCH
            design tokens
            <br />
            &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── <span className="text-accent-green">ui/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Pure
            presentational React 19 component library
            <br />
            &nbsp;&nbsp;└── <span className="text-accent-blue">tools/</span>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Policy
            compiler, drift auditor & codebase map generators
          </div>
        </div>
      </div>
    </div>
  );
}
