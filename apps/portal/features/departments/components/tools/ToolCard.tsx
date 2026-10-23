'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Bot, ExternalLink, Wifi, WifiOff, Workflow } from 'lucide-react';
import { useState } from 'react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Workflow,
  Bot,
};

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

interface ToolCardProps {
  tool: ToolStatus;
}

export default function ToolCard({ tool }: ToolCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = ICON_MAP[tool.icon] ?? ExternalLink;

  const statusColor =
    tool.status === 'online'
      ? 'text-[#3ecf8e]'
      : tool.status === 'offline'
        ? 'text-[#ef4444]'
        : 'text-[var(--text-secondary)]';

  const statusBg =
    tool.status === 'online'
      ? 'bg-[#3ecf8e]/10'
      : tool.status === 'offline'
        ? 'bg-[#ef4444]/10'
        : 'bg-[var(--bg-tertiary)]';

  const StatusIcon = tool.status === 'online' ? Wifi : WifiOff;

  return (
    <GlassCard className="flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2" style={{ backgroundColor: `${tool.color}20` }}>
            <Icon className="h-5 w-5" style={{ color: tool.color }} />
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-heading)] text-lg">{tool.displayName}</h3>
            <p className="text-[var(--text-secondary)] text-sm">{tool.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 rounded-full px-2 py-1 font-medium text-xs ${statusBg} ${statusColor}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            <span className="capitalize">{tool.status}</span>
            {tool.responseTime && tool.status === 'online' && <span>({tool.responseTime}ms)</span>}
          </div>
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] px-3 py-1.5 font-medium text-[var(--text-muted)] text-sm transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </a>
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={tool.status === 'offline'}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-sm transition-colors ${
              isOpen
                ? 'border-[#3ecf8e]/30 bg-[#3ecf8e]/20 text-[#3ecf8e]'
                : 'border-[var(--border-emphasis)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isOpen ? 'Close' : 'Embed'}
          </button>
        </div>
      </div>

      {isOpen && tool.status === 'online' && (
        <div className="fade-in slide-in-from-top-2 min-h-[500px] flex-1 animate-in overflow-hidden rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] duration-200">
          <iframe
            src={tool.url}
            title={tool.displayName}
            className="h-full min-h-[500px] w-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            loading="lazy"
          />
        </div>
      )}

      {isOpen && tool.status === 'offline' && (
        <div className="flex min-h-[200px] flex-1 items-center justify-center rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)]">
          <div className="text-center">
            <WifiOff className="mx-auto mb-2 h-8 w-8 text-[#ef4444]" />
            <p className="text-[var(--text-muted)]">{tool.displayName} is not running</p>
            <p className="mt-1 text-[var(--text-secondary)] text-sm">
              Start it locally or configure the URL
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
