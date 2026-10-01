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
    <div className="p-3 flex items-center space-x-4 w-64 bg-[#ffffff] border-2 border-color-border-subtle rounded-md shadow-sm">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-bold text-color-text-primary truncate">{jobName}</span>
          <span className="text-xs font-semibold text-color-text-secondary capitalize">
            {status}
          </span>
        </div>
        <div className="w-full bg-color-bg-sunken h-2 rounded-full overflow-hidden border border-color-border-subtle">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${getStatusColor()} ${status === 'running' ? 'animate-pulse' : ''}`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
