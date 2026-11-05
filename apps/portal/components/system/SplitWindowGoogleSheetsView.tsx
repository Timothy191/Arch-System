'use client';

import { ExternalLink, FileSpreadsheet, Maximize2 } from 'lucide-react';
import * as React from 'react';

const GOOGLE_SHEETS_AUTO_SIGNIN_URL =
  'https://accounts.google.com/AccountChooser?continue=https://docs.google.com/spreadsheets/u/0/';
const GOOGLE_SHEETS_CREATE_URL = 'https://docs.google.com/spreadsheets/create';

function openDockedWindow(url: string) {
  if (typeof window === 'undefined') return;
  const halfWidth = Math.max(Math.floor((window.outerWidth || 540) / 2), 540);
  const height = Math.max(window.outerHeight || 780, 780);
  const left = (window.screenX || 0) + halfWidth;
  const top = window.screenY || 0;
  window.open(
    url,
    'arch_google_sheets_docked',
    `width=${halfWidth},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes`
  );
}

export function SplitWindowGoogleSheetsView() {
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.open(GOOGLE_SHEETS_AUTO_SIGNIN_URL, '_blank', 'noopener,noreferrer');
    }
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-white/60 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
        <FileSpreadsheet className="h-6 w-6" />
      </span>
      <div>
        <h3 className="font-bold text-[14px] text-[var(--text-heading)]">
          Google Sheets (Excel) Workspace
        </h3>
        <p className="mt-1 max-w-sm text-[12px] text-[var(--text-secondary)]">
          Google Sheets opens in a new tab using your active Google session. Keep this pane open to
          launch additional sheets side-by-side.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openDockedWindow(GOOGLE_SHEETS_AUTO_SIGNIN_URL)}
          className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 font-medium text-[11.5px] text-[var(--text-heading)] shadow-2xs hover:bg-black/[0.03]"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Popout Window
        </button>
        <a
          href={GOOGLE_SHEETS_CREATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-[11.5px] text-white shadow-2xs hover:bg-emerald-700"
        >
          New Sheet
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
