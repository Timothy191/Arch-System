import { CloudOff } from 'lucide-react';
import type { Metadata } from 'next';
import type React from 'react';
import ReloadButton from './ReloadButton';

export const metadata: Metadata = {
  title: 'Offline | Arch OS',
  description: 'You are currently offline.',
};

export default function OfflinePage(): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 rounded-full bg-[var(--bg-tertiary)]/60 p-4">
        <CloudOff className="h-12 w-12 text-[var(--text-muted)]" />
      </div>
      <h1 className="mb-2 font-semibold text-2xl text-[var(--text-heading)]">You're Offline</h1>
      <p className="mb-8 max-w-md text-[var(--text-muted)]">
        It looks like you've lost your network connection. Some features of the Arch Portal are
        unavailable until your connection is restored.
      </p>
      <ReloadButton />
    </div>
  );
}
