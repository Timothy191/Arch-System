'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { History, MessageSquare, Wrench } from 'lucide-react';

export function ControlRoomActivityFeed({ departmentId }: { departmentId: string }) {
  const feed = [
    {
      id: 1,
      type: 'note',
      text: 'Shift handover complete. No pending escalations.',
      author: 'John Doe',
      time: '06:05 AM',
    },
    {
      id: 2,
      type: 'system',
      text: 'Excavator 01 moved from Maintenance to Operational.',
      author: 'System',
      time: '07:30 AM',
    },
    {
      id: 3,
      type: 'action',
      text: 'Breakdown reported for Dump Truck 14 (Hydraulics).',
      author: 'Sarah Smith',
      time: '08:15 AM',
    },
  ];

  return (
    <GlassCard variant="spotlight" className="p-0 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-arch-border-subtle bg-arch-surface-secondary/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-arch-brand-blue" />
          <h3 className="text-sm font-bold text-arch-text-primary">Shift Activity Feed</h3>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {feed.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div className="relative flex-none">
              <div className="w-8 h-8 rounded-full bg-arch-surface-tertiary border border-arch-border-subtle flex items-center justify-center">
                {item.type === 'note' && (
                  <MessageSquare className="w-3.5 h-3.5 text-arch-text-secondary" />
                )}
                {item.type === 'system' && <History className="w-3.5 h-3.5 text-arch-brand-blue" />}
                {item.type === 'action' && <Wrench className="w-3.5 h-3.5 text-accent-red" />}
              </div>
              <div className="absolute top-8 bottom-[-16px] left-1/2 -ml-px w-px bg-arch-border-subtle" />
            </div>
            <div className="flex-1 pb-4">
              <p className="text-sm text-arch-text-primary">{item.text}</p>
              <div className="flex items-center gap-2 text-xs text-arch-text-muted mt-1.5">
                <span className="font-medium">{item.author}</span>
                <span>•</span>
                <span>{item.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
