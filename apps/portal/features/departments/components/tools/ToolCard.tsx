"use client";

import { useState } from "react";
import { Workflow, Bot, ExternalLink, Wifi, WifiOff } from "lucide-react";
import { GlassCard } from "@repo/ui/GlassCard";

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
  status: "online" | "offline" | "unknown";
  responseTime?: number;
}

interface ToolCardProps {
  tool: ToolStatus;
}

export default function ToolCard({ tool }: ToolCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = ICON_MAP[tool.icon] ?? ExternalLink;

  const statusColor =
    tool.status === "online"
      ? "text-[#3ecf8e]"
      : tool.status === "offline"
        ? "text-[#ef4444]"
        : "text-[var(--text-secondary)]";

  const statusBg =
    tool.status === "online"
      ? "bg-[#3ecf8e]/10"
      : tool.status === "offline"
        ? "bg-[#ef4444]/10"
        : "bg-[var(--bg-tertiary)]";

  const StatusIcon = tool.status === "online" ? Wifi : WifiOff;

  return (
    <GlassCard className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${tool.color}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: tool.color }} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-[var(--text-heading)]">
              {tool.displayName}
            </h3>
            <p className="text-[var(--text-secondary)] text-sm">
              {tool.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusBg} ${statusColor}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span className="capitalize">{tool.status}</span>
            {tool.responseTime && tool.status === "online" && (
              <span>({tool.responseTime}ms)</span>
            )}
          </div>
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-muted)] text-sm font-medium hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)] transition-colors border border-[var(--border-emphasis)]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </a>
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={tool.status === "offline"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              isOpen
                ? "bg-[#3ecf8e]/20 text-[#3ecf8e] border-[#3ecf8e]/30"
                : "bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border-emphasis)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isOpen ? "Close" : "Embed"}
          </button>
        </div>
      </div>

      {isOpen && tool.status === "online" && (
        <div className="flex-1 min-h-[500px] rounded-lg border border-[var(--border-emphasis)] overflow-hidden bg-[var(--bg-primary)] animate-in fade-in slide-in-from-top-2 duration-200">
          <iframe
            src={tool.url}
            title={tool.displayName}
            className="w-full h-full min-h-[500px]"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            loading="lazy"
          />
        </div>
      )}

      {isOpen && tool.status === "offline" && (
        <div className="flex-1 min-h-[200px] rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] flex items-center justify-center">
          <div className="text-center">
            <WifiOff className="w-8 h-8 text-[#ef4444] mx-auto mb-2" />
            <p className="text-[var(--text-muted)]">
              {tool.displayName} is not running
            </p>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              Start it locally or configure the URL
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
