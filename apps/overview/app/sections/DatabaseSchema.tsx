import { DATABASE_SCHEMA } from "@/lib/data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Table2, Key, ArrowRight } from "lucide-react";

export default function DatabaseSchema() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[#fafafa]">
          Database Schema
        </h2>
        <p className="text-[#b4b4b4] mt-1">
          PostgreSQL tables with Row Level Security (RLS) policies
        </p>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {DATABASE_SCHEMA.map((table) => (
          <Card
            key={table.name}
            className="bg-[#171717] border-[#363636] overflow-hidden"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-[#60a5fa]" />
                  <CardTitle className="text-lg text-[#fafafa] font-mono">
                    {table.name}
                  </CardTitle>
                </div>
                {table.rls && (
                  <Badge
                    variant="accent"
                    className="text-[10px] flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    RLS
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {table.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {table.columns.map((column) => (
                  <div
                    key={column}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#242424] text-xs"
                  >
                    {column.includes("PK") && (
                      <Key className="w-3 h-3 text-[#007aff]" />
                    )}
                    {column.includes("FK") && (
                      <ArrowRight className="w-3 h-3 text-[#60a5fa]" />
                    )}
                    {!column.includes("PK") && !column.includes("FK") && (
                      <div className="w-3" />
                    )}
                    <span className="font-mono text-[#b4b4b4]">{column}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Relationships Diagram */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-[#fafafa] mb-4">
          Table Relationships
        </h3>
        <div className="glass-card p-6 rounded-xl">
          <div className="flex flex-wrap justify-center gap-8">
            {/* Central: departments */}
            <div className="flex flex-col items-center">
              <div className="px-4 py-2 bg-[#3ecf8e]/10 border border-[#3ecf8e] rounded-lg text-[#3ecf8e] font-mono text-sm font-medium">
                departments
              </div>
              <div className="text-xs text-[#898989] mt-1">Central</div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <ArrowRight className="w-5 h-5 text-[#363636] rotate-90 md:rotate-0" />
              <span className="text-xs text-[#898989]">1:N</span>
            </div>

            {/* Connected tables */}
            <div className="flex flex-wrap gap-4 justify-center">
              {["employees", "machines", "daily_logs"].map((table) => (
                <div key={table} className="flex flex-col items-center">
                  <div className="px-4 py-2 bg-[#60a5fa]/10 border border-[#60a5fa] rounded-lg text-[#60a5fa] font-mono text-sm font-medium">
                    {table}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Child tables */}
          <div className="mt-8 pt-6 border-t border-[#363636]">
            <div className="text-xs text-[#898989] mb-3 text-center uppercase tracking-wider">
              Child Tables (reference daily_logs)
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {["machine_hours", "fuel_logs", "production_logs"].map(
                (table) => (
                  <div key={table} className="flex flex-col items-center">
                    <div className="px-4 py-2 bg-[#a78bfa]/10 border border-[#a78bfa] rounded-lg text-[#a78bfa] font-mono text-sm font-medium">
                      {table}
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#363636] -rotate-90 mt-2" />
                    <span className="text-xs text-[#898989] mt-1">N:1</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RLS Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-[#3ecf8e]" />
            <span className="text-sm font-medium text-[#fafafa]">
              Row Level Security
            </span>
          </div>
          <p className="text-xs text-[#b4b4b4]">
            All tables have RLS enabled with department-based access policies
          </p>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-[#007aff]" />
            <span className="text-sm font-medium text-[#fafafa]">
              Auth Integration
            </span>
          </div>
          <p className="text-xs text-[#b4b4b4]">
            employees table linked to auth.users via auth_id with trigger on
            signup
          </p>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Table2 className="w-5 h-5 text-[#60a5fa]" />
            <span className="text-sm font-medium text-[#fafafa]">
              7 Tables Total
            </span>
          </div>
          <p className="text-xs text-[#b4b4b4]">
            Core tables: departments, employees, machines, daily_logs + 3 child
            tables
          </p>
        </div>
      </div>

      {/* Helper Functions */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-[#fafafa] mb-4">
          RLS Helper Functions
        </h3>
        <div className="glass-card p-6 rounded-xl font-mono text-sm">
          <div className="text-[#b4b4b4] space-y-2">
            <div className="text-[#898989]">-- Department access check</div>
            <div>
              <span className="text-[#3ecf8e]">auth.user_department_id</span>
              <span className="text-[#b4b4b4]">() → UUID</span>
            </div>
            <br />
            <div className="text-[#898989]">-- Admin check</div>
            <div>
              <span className="text-[#3ecf8e]">auth.is_admin</span>
              <span className="text-[#b4b4b4]">() → boolean</span>
            </div>
            <br />
            <div className="text-[#898989]">
              -- Department access with array support
            </div>
            <div>
              <span className="text-[#3ecf8e]">auth.has_department_access</span>
              <span className="text-[#b4b4b4]">(dept_id UUID) → boolean</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
