'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { GlassCard } from '@repo/ui/GlassCard';
import { getOperationalToday } from '@repo/utils';
import { History, MessageSquare, RefreshCw, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ActivityFeedItem {
  id: string;
  type: 'note' | 'system' | 'action';
  text: string;
  author: string;
  time: string;
  timestamp: number;
}

function formatEventTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Just now';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  });
}

export function ControlRoomActivityFeed({ departmentId }: { departmentId: string }) {
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const today = getOperationalToday('Africa/Johannesburg');

      const [notesRes, breakdownsRes, shiftReportsRes, machineOpsRes] = await Promise.all([
        supabase
          .from('engineering_notes')
          .select('id, note_text, shift, created_at, machine:machines(name)')
          .eq('department_id', departmentId)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('breakdowns')
          .select('id, description, category, status, created_at, equipment_name')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('control_room_shift_reports')
          .select('id, operator_name, shift_type, status, summary_notes, created_at')
          .eq('department_id', departmentId)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('machine_operations')
          .select(
            'id, shift, hours_worked, created_at, machine:machines(name), operator:operators(full_name)'
          )
          .eq('department_id', departmentId)
          .eq('shift_date', today)
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      const items: ActivityFeedItem[] = [];

      for (const note of notesRes.data ?? []) {
        const machineObj = Array.isArray(note.machine) ? note.machine[0] : note.machine;
        const prefix = machineObj?.name ? `[${machineObj.name}] ` : '';
        items.push({
          id: `note-${note.id}`,
          type: 'note',
          text: `${prefix}${note.note_text}`,
          author: `Engineering (${(note.shift || 'day').toUpperCase()})`,
          time: formatEventTime(note.created_at),
          timestamp: note.created_at ? new Date(note.created_at).getTime() : 0,
        });
      }

      for (const bd of breakdownsRes.data ?? []) {
        items.push({
          id: `bd-${bd.id}`,
          type: 'action',
          text: `Breakdown (${bd.status || 'open'}): ${bd.equipment_name || 'Fleet Unit'} — ${bd.description || bd.category || 'Maintenance event'}`,
          author: 'Breakdown Alert',
          time: formatEventTime(bd.created_at),
          timestamp: bd.created_at ? new Date(bd.created_at).getTime() : 0,
        });
      }

      for (const report of shiftReportsRes.data ?? []) {
        items.push({
          id: `sr-${report.id}`,
          type: 'system',
          text:
            report.summary_notes ||
            `Shift closeout (${(report.shift_type || 'day').toUpperCase()}) recorded [${report.status || 'submitted'}].`,
          author: report.operator_name || 'Control Room Operator',
          time: formatEventTime(report.created_at),
          timestamp: report.created_at ? new Date(report.created_at).getTime() : 0,
        });
      }

      for (const op of machineOpsRes.data ?? []) {
        const machineObj = Array.isArray(op.machine) ? op.machine[0] : op.machine;
        const operatorObj = Array.isArray(op.operator) ? op.operator[0] : op.operator;
        items.push({
          id: `op-${op.id}`,
          type: 'system',
          text: `${machineObj?.name || 'Machine'} logged ${(op.hours_worked ?? 0).toFixed(1)}h SMR on ${(op.shift || 'day').toUpperCase()} shift.`,
          author: operatorObj?.full_name || 'Shift Dispatch',
          time: formatEventTime(op.created_at),
          timestamp: op.created_at ? new Date(op.created_at).getTime() : 0,
        });
      }

      items.sort((a, b) => b.timestamp - a.timestamp);
      setFeed(items.slice(0, 10));
    } catch {
      setFeed([]);
    } finally {
      setIsLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  return (
    <GlassCard variant="spotlight" className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between border-arch-border-subtle border-b bg-arch-surface-secondary/50 p-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-arch-brand-blue" />
          <h3 className="font-bold text-arch-text-primary text-sm">Shift Activity Feed</h3>
        </div>
        <button
          type="button"
          onClick={() => void loadFeed()}
          aria-label="Refresh Shift Activity Feed"
          className="cursor-pointer rounded-md p-1 text-arch-text-secondary transition-colors hover:bg-black/5 hover:text-arch-text-primary"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {feed.length === 0 ? (
          <div className="py-8 text-center text-arch-text-muted text-xs">
            {isLoading
              ? 'Loading live shift events...'
              : 'No shift activity events recorded yet for this shift.'}
          </div>
        ) : (
          feed.map((item, idx) => (
            <div key={item.id} className="flex gap-4">
              <div className="relative flex-none">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-arch-border-subtle bg-arch-surface-tertiary">
                  {item.type === 'note' && (
                    <MessageSquare className="h-3.5 w-3.5 text-arch-text-secondary" />
                  )}
                  {item.type === 'system' && (
                    <History className="h-3.5 w-3.5 text-arch-brand-blue" />
                  )}
                  {item.type === 'action' && <Wrench className="h-3.5 w-3.5 text-accent-red" />}
                </div>
                {idx < feed.length - 1 && (
                  <div className="absolute top-8 bottom-[-16px] left-1/2 -ml-px w-px bg-arch-border-subtle" />
                )}
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
          ))
        )}
      </div>
    </GlassCard>
  );
}
