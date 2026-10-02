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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-heading)] flex flex-col">
      {/* Universal Admin Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-white/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between px-6 py-3 gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/hub"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors bg-zinc-100 px-2.5 py-1.5 rounded-md"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Hub
            </Link>
            <div className="h-4 w-px bg-zinc-200" />
            <span className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Arch Operations Console
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/admin"
              className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <Cpu className="h-3.5 w-3.5 text-zinc-500" />
              General
            </Link>
            <Link
              href="/admin/workflows"
              className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <N8nIcon className="h-3.5 w-3.5" color="#ea4b71" />
              n8n Workflows
            </Link>
            <Link
              href="/admin/redis"
              className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <RedisIcon className="h-3.5 w-3.5" color="#dc382d" />
              RedisInsight
            </Link>
            <Link
              href="/admin/ai-metrics"
              className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
              AI Metrics
            </Link>
          </nav>

          {/* Operator Identity Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              SUPER-ADMIN
            </span>
            <span className="text-xs text-zinc-500 font-mono hidden md:inline">{user.email}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
