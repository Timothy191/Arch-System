import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { ArrowRight, Key, Lock, Table2 } from 'lucide-react';
import { DATABASE_SCHEMA } from '../lib/data';

export default function DatabaseSchema() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="font-semibold text-2xl text-text-heading">Database Schema</h2>
        <p className="mt-1 text-text-secondary">
          PostgreSQL tables with Row Level Security (RLS) policies
        </p>
      </div>

      {/* Tables Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {DATABASE_SCHEMA.map((table) => (
          <Card key={table.name} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="h-5 w-5 text-accent-blue" />
                  <CardTitle className="font-mono text-lg text-text-heading">
                    {table.name}
                  </CardTitle>
                </div>
                {table.rls && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 border-accent-green/30 bg-accent-green/10 text-[10px] text-accent-green"
                  >
                    <Lock className="h-3 w-3" />
                    RLS
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">{table.description}</CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {table.columns.map((column) => (
                  <div
                    key={column}
                    className="flex items-center gap-2 rounded bg-bg-tertiary px-2 py-1.5 text-xs"
                  >
                    {column.includes('PK') && <Key className="h-3 w-3 text-accent-blue" />}
                    {column.includes('FK') && <ArrowRight className="h-3 w-3 text-accent-blue" />}
                    {!column.includes('PK') && !column.includes('FK') && <div className="w-3" />}
                    <span className="font-mono text-text-secondary">{column}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Relationships Diagram */}
      <div className="mb-6">
        <h3 className="mb-4 font-medium text-lg text-text-heading">Table Relationships</h3>
        <div className="glass-card rounded-xl p-6">
          <div className="flex flex-wrap justify-center gap-8">
            {/* Central: departments */}
            <div className="flex flex-col items-center">
              <div className="rounded-lg border border-accent-green bg-accent-green/10 px-4 py-2 font-medium font-mono text-accent-green text-sm">
                departments
              </div>
              <div className="mt-1 text-text-muted text-xs">Central</div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <ArrowRight className="h-5 w-5 rotate-90 text-border-default md:rotate-0" />
              <span className="text-text-muted text-xs">1:N</span>
            </div>

            {/* Connected tables */}
            <div className="flex flex-wrap justify-center gap-4">
              {['employees', 'personnel', 'machines', 'daily_logs', 'breakdowns'].map((table) => (
                <div key={table} className="flex flex-col items-center">
                  <div className="rounded-lg border border-accent-blue bg-accent-blue/10 px-4 py-2 font-medium font-mono text-accent-blue text-sm">
                    {table}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Child tables */}
          <div className="mt-8 border-default border-t pt-6">
            <div className="mb-3 text-center text-text-muted text-xs uppercase tracking-wider">
              Child & Telemetry Tables (reference daily_logs, machines & personnel)
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                'badges',
                'machine_operations',
                'smr_readings',
                'monthly_machine_snapshots',
                'hourly_loads',
                'delay_entries',
                'scada_telemetry_records',
                'card_print_jobs',
                'access_logs',
                'audit_logs',
              ].map((table) => (
                <div key={table} className="flex flex-col items-center">
                  <div className="rounded-lg border border-accent-amber bg-accent-amber/10 px-4 py-2 font-medium font-mono text-accent-amber text-sm">
                    {table}
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 -rotate-90 text-border-default" />
                  <span className="mt-1 text-text-muted text-xs">N:1</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RLS Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-5 w-5 text-accent-green" />
            <span className="font-medium text-sm text-text-heading">
              100% RLS InitPlan Security
            </span>
          </div>
          <p className="text-text-secondary text-xs">
            Every table enforces Row Level Security with cached (select auth.uid()) InitPlan
            department policies
          </p>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Key className="h-5 w-5 text-accent-blue" />
            <span className="font-medium text-sm text-text-heading">213 Versioned Migrations</span>
          </div>
          <p className="text-text-secondary text-xs">
            Supabase PostgreSQL 17 schema managed via zero-padded declarative migrations & atomic
            RPCs
          </p>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Table2 className="h-5 w-5 text-accent-blue" />
            <span className="font-medium text-sm text-text-heading">
              {DATABASE_SCHEMA.length} Core Domain Tables
            </span>
          </div>
          <p className="text-text-secondary text-xs">
            Departments, employees, personnel, badges, machines, daily_logs, breakdowns, loads &
            audit trails
          </p>
        </Card>
      </div>

      {/* Helper Functions */}
      <div className="mt-8">
        <h3 className="mb-4 font-medium text-lg text-text-heading">RLS Helper Functions</h3>
        <div className="glass-card rounded-xl p-6 font-mono text-sm">
          <div className="space-y-2 text-text-secondary">
            <div className="text-text-muted">-- Department access check</div>
            <div>
              <span className="text-accent-green">auth.user_department_id</span>
              <span className="text-text-secondary">() → UUID</span>
            </div>
            <br />
            <div className="text-text-muted">-- Admin check</div>
            <div>
              <span className="text-accent-green">auth.is_admin</span>
              <span className="text-text-secondary">() → boolean</span>
            </div>
            <br />
            <div className="text-text-muted">-- Department access with array support</div>
            <div>
              <span className="text-accent-green">auth.has_department_access</span>
              <span className="text-text-secondary">(dept_id UUID) → boolean</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
