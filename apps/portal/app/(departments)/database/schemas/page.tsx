import { Badge } from '@repo/ui';
import { Divider } from '@repo/ui/Divider';
import { Database, Lock, ShieldCheck } from 'lucide-react';
import DatabaseSchema from '@/app/overview/sections/DatabaseSchema';

export default async function DatabaseSchemasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2.5 font-semibold text-2xl text-[var(--text-heading)]">
            <Database className="h-6 w-6 text-accent-green" />
            Supabase PostgreSQL 17 Schema & RLS Catalog
          </h2>
          <p className="mt-1 text-[var(--text-secondary)] text-xs">
            Authoritative table definitions, primary/foreign key relationships, and Row Level
            Security (RLS) InitPlan helper functions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="green" size="sm">
            <Lock className="mr-1 inline h-3 w-3" />
            100% RLS Enabled
          </Badge>
          <Badge variant="blue" size="sm">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
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
