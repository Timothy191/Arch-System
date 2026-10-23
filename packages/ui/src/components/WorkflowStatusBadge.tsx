import { GlassCard } from '@repo/ui/GlassCard';
import React from 'react';

export interface WorkflowStatusBadgeProps {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  jobName: string;
}

export function WorkflowStatusBadge({ status, progress, jobName }: WorkflowStatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-color-status-positive';
      case 'failed':
        return 'bg-color-status-danger';
      case 'running':
        return 'bg-color-action-primary';
      default:
        return 'bg-color-bg-elevated border-color-border-subtle';
    }
  };

  return (
    <div className="flex w-64 items-center space-x-4 rounded-md border-2 border-color-border-subtle bg-[#ffffff] p-3 shadow-sm">
      <div className="flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="truncate font-bold text-color-text-primary text-sm">{jobName}</span>
          <span className="font-semibold text-color-text-secondary text-xs capitalize">
            {status}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full border border-color-border-subtle bg-color-bg-sunken">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${getStatusColor()} ${status === 'running' ? 'animate-pulse' : ''}`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
