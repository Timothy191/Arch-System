import type React from 'react';
import type { SplitService } from '@/hooks/useSplitWindow';

export const SERVICE_META: Record<
  SplitService,
  { label: string; shortLabel: string; Icon: React.ReactNode }
> = {
  'google-calendar': {
    label: 'Google Calendar: Shift Schedule',
    shortLabel: 'Google Calendar',
    Icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="3" fill="#4285F4" />
        <path d="M3 9h18" stroke="#FFFFFF" strokeWidth="1.5" />
        <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" />
        <rect x="7" y="13" width="3" height="3" rx="0.5" fill="#FFFFFF" />
        <rect x="14" y="13" width="3" height="3" rx="0.5" fill="#FFFFFF" />
      </svg>
    ),
  },
  'google-sheets': {
    label: 'Excel: Google Sheets Workspace',
    shortLabel: 'Excel',
    Icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58" />
        <path d="M3 9h18M9 3v18" stroke="#FFFFFF" strokeWidth="1.5" />
        <rect x="4.5" y="4.5" width="3" height="3" fill="#FFFFFF" opacity="0.9" />
      </svg>
    ),
  },
};
