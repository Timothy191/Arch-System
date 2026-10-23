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
    <GlassCard variant="spotlight" className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between border-arch-border-subtle border-b bg-arch-surface-secondary/50 p-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-arch-brand-blue" />
          <h3 className="font-bold text-arch-text-primary text-sm">Shift Activity Feed</h3>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {feed.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div className="relative flex-none">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-arch-border-subtle bg-arch-surface-tertiary">
                {item.type === 'note' && (
                  <MessageSquare className="h-3.5 w-3.5 text-arch-text-secondary" />
                )}
                {item.type === 'system' && <History className="h-3.5 w-3.5 text-arch-brand-blue" />}
                {item.type === 'action' && <Wrench className="h-3.5 w-3.5 text-accent-red" />}
              </div>
              <div className="absolute top-8 bottom-[-16px] left-1/2 -ml-px w-px bg-arch-border-subtle" />
            </div>
            <div className="flex-1 pb-4">
              <p className="text-arch-text-primary text-sm">{item.text}</p>
              <div className="mt-1.5 flex items-center gap-2 text-arch-text-muted text-xs">
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
