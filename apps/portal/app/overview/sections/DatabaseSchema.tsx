import { DATABASE_SCHEMA } from "../lib/data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Lock, Table2, Key, ArrowRight } from "lucide-react";

export default function DatabaseSchema() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-text-heading">Database Schema</h2>
        <p className="text-text-secondary mt-1">
          PostgreSQL tables with Row Level Security (RLS) policies
        </p>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {DATABASE_SCHEMA.map((table) => (
          <Card key={table.name} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-accent-blue" />
                  <CardTitle className="text-lg text-text-heading font-mono">
                    {table.name}
                  </CardTitle>
                </div>
                {table.rls && (
                  <Badge
                    variant="outline"
                    className="text-[10px] flex items-center gap-1 text-accent-green border-accent-green/30 bg-accent-green/10"
                  >
                    <Lock className="w-3 h-3" />
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
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-tertiary text-xs"
                  >
                    {column.includes("PK") && <Key className="w-3 h-3 text-accent-blue" />}
                    {column.includes("FK") && <ArrowRight className="w-3 h-3 text-accent-blue" />}
                    {!column.includes("PK") && !column.includes("FK") && <div className="w-3" />}
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
        <h3 className="text-lg font-medium text-text-heading mb-4">Table Relationships</h3>
        <div className="glass-card p-6 rounded-xl">
          <div className="flex flex-wrap justify-center gap-8">
            {/* Central: departments */}
            <div className="flex flex-col items-center">
              <div className="px-4 py-2 bg-accent-green/10 border border-accent-green rounded-lg text-accent-green font-mono text-sm font-medium">
                departments
              </div>
              <div className="text-xs text-text-muted mt-1">Central</div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <ArrowRight className="w-5 h-5 text-border-default rotate-90 md:rotate-0" />
              <span className="text-xs text-text-muted">1:N</span>
            </div>

            {/* Connected tables */}
            <div className="flex flex-wrap gap-4 justify-center">
              {["employees", "machines", "daily_logs"].map((table) => (
                <div key={table} className="flex flex-col items-center">
                  <div className="px-4 py-2 bg-accent-blue/10 border border-accent-blue rounded-lg text-accent-blue font-mono text-sm font-medium">
                    {table}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Child tables */}
          <div className="mt-8 pt-6 border-t border-default">
            <div className="text-xs text-text-muted mb-3 text-center uppercase tracking-wider">
              Child Tables (reference daily_logs)
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {["machine_hours", "fuel_logs", "production_logs"].map((table) => (
                <div key={table} className="flex flex-col items-center">
                  <div className="px-4 py-2 bg-accent-amber/10 border border-accent-amber rounded-lg text-accent-amber font-mono text-sm font-medium">
                    {table}
                  </div>
                  <ArrowRight className="w-4 h-4 text-border-default -rotate-90 mt-2" />
                  <span className="text-xs text-text-muted mt-1">N:1</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RLS Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-accent-green" />
            <span className="text-sm font-medium text-text-heading">Row Level Security</span>
          </div>
          <p className="text-xs text-text-secondary">
            All tables have RLS enabled with department-based access policies
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-accent-blue" />
            <span className="text-sm font-medium text-text-heading">Auth Integration</span>
          </div>
          <p className="text-xs text-text-secondary">
            employees table linked to auth.users via auth_id with trigger on signup
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Table2 className="w-5 h-5 text-accent-blue" />
            <span className="text-sm font-medium text-text-heading">7 Tables Total</span>
          </div>
          <p className="text-xs text-text-secondary">
            Core tables: departments, employees, machines, daily_logs + 3 child tables
          </p>
        </Card>
      </div>

      {/* Helper Functions */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-text-heading mb-4">RLS Helper Functions</h3>
        <div className="glass-card p-6 rounded-xl font-mono text-sm">
          <div className="text-text-secondary space-y-2">
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
