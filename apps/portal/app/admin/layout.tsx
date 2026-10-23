import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { N8nIcon } from '@repo/ui/N8nIcon';
import { RedisIcon } from '@repo/ui/RedisIcon';
import { Activity, ArrowLeft, Cpu, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import React from 'react';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  // Authenticate user
  if (!user) {
    redirect('/login');
  }

  // Allow admin role or primary operator email
  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  const isAdmin = employee?.role === 'admin';

  if (!isAdmin) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-[var(--text-heading)]">
      {/* Universal Admin Navigation Bar */}
      <header className="gold-steel-border gold-steel-border-slim sticky top-0 z-50 border-[var(--border-default)] border-b bg-white/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/hub"
              className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 font-semibold text-xs text-zinc-500 transition-colors hover:text-zinc-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Hub
            </Link>
            <div className="h-4 w-px bg-zinc-200" />
            <span className="flex items-center gap-2 font-semibold text-base text-zinc-900">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Arch Operations Console
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/admin"
              className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <Cpu className="h-3.5 w-3.5 text-zinc-500" />
              General
            </Link>
            <Link
              href="/admin/workflows"
              className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <N8nIcon className="h-3.5 w-3.5" color="#ea4b71" />
              n8n Workflows
            </Link>
            <Link
              href="/admin/redis"
              className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <RedisIcon className="h-3.5 w-3.5" color="#dc382d" />
              RedisInsight
            </Link>
            <Link
              href="/admin/ai-metrics"
              className="gold-steel-border gold-steel-border-slim flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
              AI Metrics
            </Link>
          </nav>

          {/* Operator Identity Badge */}
          <div className="flex items-center gap-2">
            <span className="gold-steel-border gold-steel-border-slim inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono font-semibold text-[11px] text-indigo-700">
              SUPER-ADMIN
            </span>
            <span className="hidden font-mono text-xs text-zinc-500 md:inline">{user.email}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
