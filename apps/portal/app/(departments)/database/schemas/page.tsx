import { Badge } from '@repo/ui';
import { Divider } from '@repo/ui/Divider';
import { Database, Lock, ShieldCheck } from 'lucide-react';
import DatabaseSchema from '@/app/overview/sections/DatabaseSchema';

export default async function DatabaseSchemasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-heading)] flex items-center gap-2.5">
            <Database className="w-6 h-6 text-accent-green" />
            Supabase PostgreSQL 17 Schema & RLS Catalog
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Authoritative table definitions, primary/foreign key relationships, and Row Level
            Security (RLS) InitPlan helper functions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="green" size="sm">
            <Lock className="w-3 h-3 mr-1 inline" />
            100% RLS Enabled
          </Badge>
          <Badge variant="blue" size="sm">
            <ShieldCheck className="w-3 h-3 mr-1 inline" />
            186 Migrations
          </Badge>
        </div>
      </div>

      <Divider variant="fading" label="SCHEMA DEFINITIONS & RELATIONSHIPS" />

      <div className="-mx-6">
        <DatabaseSchema />
      </div>
    </div>
  );
}
