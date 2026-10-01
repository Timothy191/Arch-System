'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { CheckSquare, ClipboardCheck, Clock, FileCheck } from 'lucide-react';
import { useState } from 'react';

interface ChecklistWidgetProps {
  departmentId: string;
  departmentSlug: string;
  date: string;
  shift: string;
}

export function ControlRoomChecklistWidget({
  departmentId,
  departmentSlug,
  date,
  shift,
}: ChecklistWidgetProps) {
  const [items, setItems] = useState([
    { id: 1, label: 'Review previous shift handover notes', completed: true },
    { id: 2, label: 'Acknowledge all active safety bulletins', completed: false },
    { id: 3, label: 'Verify SCADA telemetry streams are online', completed: true },
    { id: 4, label: 'Complete half-shift production reconciliation', completed: false },
    { id: 5, label: 'Verify equipment availability with engineering', completed: false },
  ]);

  const toggleItem = (id: number) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const completedCount = items.filter((i) => i.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);

  return (
    <GlassCard variant="spotlight" className="p-0 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-arch-border-subtle bg-arch-surface-secondary/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-arch-brand-blue" />
          <h3 className="text-sm font-bold text-arch-text-primary">Shift Control Checklist</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-arch-text-muted">
          <Clock className="w-3.5 h-3.5" />
          Shift: {shift.toUpperCase()}
        </div>
      </div>

      <div className="p-5 flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-3">
          {items.map((item) => (
            <label
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                item.completed
                  ? 'bg-accent-green/5 border-accent-green/20'
                  : 'bg-arch-surface-base border-arch-border-subtle hover:border-arch-brand-blue/30'
              }`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                  item.completed
                    ? 'bg-accent-green border-accent-green text-white'
                    : 'bg-transparent border-arch-border-strong text-transparent'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={item.completed}
                onChange={() => toggleItem(item.id)}
              />
              <span
                className={`text-sm font-medium ${
                  item.completed
                    ? 'text-arch-text-secondary line-through opacity-70'
                    : 'text-arch-text-primary'
                }`}
              >
                {item.label}
              </span>
            </label>
          ))}
        </div>

        <div className="w-full md:w-64 flex flex-col justify-between">
          <div className="p-4 rounded-xl bg-arch-surface-secondary/50 border border-arch-border-subtle flex flex-col items-center justify-center text-center space-y-2">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-arch-surface-tertiary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="text-arch-brand-blue transition-all duration-500 ease-out"
                  strokeDasharray={`${progress}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-xl font-bold text-arch-text-primary">{progress}%</span>
              </div>
            </div>
            <p className="text-xs text-arch-text-muted mt-2">
              {completedCount} of {items.length} tasks completed
            </p>
          </div>

          <button
            type="button"
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white font-medium rounded-xl transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileCheck className="w-4 h-4" />
            Proceed to Shift Closeout
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
