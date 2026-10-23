'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import ToolCard from './ToolCard';

const UniverSheet = dynamic(() => import('./UniverSheet'), {
  ssr: false,
  loading: () => <div className="h-[600px] animate-pulse rounded-lg bg-arch-surface-tertiary" />,
});

interface ToolStatus {
  name: string;
  displayName: string;
  url: string;
  description: string;
  icon: string;
  color: string;
  status: 'online' | 'offline' | 'unknown';
  responseTime?: number;
}

interface ToolsPageClientProps {
  departmentName: string;
  initialTools: ToolStatus[];
}

export default function ToolsPageClient({ departmentName, initialTools }: ToolsPageClientProps) {
  const [tools, setTools] = useState<ToolStatus[]>(initialTools);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function refreshStatus(showLoading = false) {
      if (showLoading) setLoading(true);
      try {
        const response = await fetch('/api/tools/status', {
          cache: 'no-store',
        });
        if (response.ok) {
          const data = await response.json();
          setTools(data.tools);
        }
      } catch {
        // Keep initial tools on error
      } finally {
        if (showLoading) setLoading(false);
      }
    }

    refreshStatus(false);
    const interval = setInterval(() => refreshStatus(false), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-2xl text-[var(--text-heading)]">Tools</h2>
        {loading && (
          <span className="text-[var(--text-secondary)] text-sm">Checking status...</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <GlassCard className="flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-[var(--text-heading)] text-lg">Spreadsheet</h3>
              <p className="text-[var(--text-secondary)] text-sm">
                Embedded Univer spreadsheet for calculations and data entry
              </p>
            </div>
          </div>
          <div className="min-h-[600px] flex-1 overflow-hidden rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)]">
            <UniverSheet id={`univer-${departmentName}`} />
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {tools.map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </div>
    </div>
  );
}
