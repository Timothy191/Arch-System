'use client';

import { ClipboardList, TableProperties } from 'lucide-react';
import { type ReactNode, useState } from 'react';

interface EngineeringNotesTabsClientProps {
  initialTab: 'overview' | 'notes';
  overviewContent: ReactNode;
  notesContent: ReactNode;
  machineCount: number;
  notesCount: number;
}

const TAB_ACTIVE =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-white text-xs shadow-sm transition-colors';
const TAB_INACTIVE =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-semibold text-[var(--text-secondary)] text-xs transition-colors hover:bg-black/5 hover:text-[var(--text-heading)]';

export function EngineeringNotesTabsClient({
  initialTab,
  overviewContent,
  notesContent,
  machineCount,
  notesCount,
}: EngineeringNotesTabsClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes'>(initialTab);

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Engineering Notes Sub-Navigation"
        className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-white/80 p-1.5 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={activeTab === 'overview' ? TAB_ACTIVE : TAB_INACTIVE}
        >
          <TableProperties className="h-4 w-4" />
          <span>Overview ({machineCount} Machines)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notes'}
          onClick={() => setActiveTab('notes')}
          className={activeTab === 'notes' ? TAB_ACTIVE : TAB_INACTIVE}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Engineering Notes &amp; Breakdowns ({notesCount})</span>
        </button>
      </div>

      {activeTab === 'overview' ? overviewContent : notesContent}
    </div>
  );
}
