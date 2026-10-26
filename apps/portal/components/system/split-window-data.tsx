import type React from 'react';

export const SERVICE_META: Record<
  'github' | 'whatsapp',
  { label: string; shortLabel: string; Icon: React.ReactNode }
> = {
  github: {
    label: 'GitHub: Timothy191/ArchMK2',
    shortLabel: 'GitHub',
    Icon: (
      <svg className="h-3.5 w-3.5 fill-current text-black" viewBox="0 0 24 24">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  whatsapp: {
    label: 'WhatsApp: Operations Chat',
    shortLabel: 'WhatsApp',
    Icon: (
      <svg className="h-3.5 w-3.5 fill-current text-emerald-600" viewBox="0 0 24 24">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.896c1.675.993 3.324 1.558 5.207 1.559 5.405 0 9.803-4.375 9.806-9.754.002-2.607-1.002-5.06-2.83-6.892-1.829-1.83-4.263-2.836-6.868-2.837-5.39 0-9.786 4.377-9.79 9.753-.001 2.03.535 3.738 1.555 5.262l-.994 3.63 3.74-.981z" />
      </svg>
    ),
  },
};

export const GITHUB_COMMITS = [
  {
    hash: '7d0a059',
    msg: 'feat: access control neo 300 printing & universal QR/RFID generator',
    author: 'Timothy',
    date: 'Today, 08:25',
  },
  {
    hash: 'f2b33cf',
    msg: 'feat: C66 RFID hardware scanner attendance register endpoint',
    author: 'Timothy',
    date: 'Today, 08:05',
  },
  {
    hash: 'c87f5f0',
    msg: 'fix: supabase RLS recursion & database migration alignments',
    author: 'Timothy',
    date: 'Today, 07:45',
  },
];

export const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/';
export const WHATSAPP_AUTO_ACK_DELAY_MS = 1200;

export interface MessageItem {
  id: string;
  sender: string;
  avatar: string;
  channel: string;
  text: string;
  time: string;
  isSelf: boolean;
  status: 'sent' | 'delivered' | 'read';
}

export const CHANNELS = [
  { id: 'haulage', name: 'Coal Haulage & CT Fleet', icon: '🚛', unread: 2 },
  { id: 'weighbridge', name: 'Weighbridge Inbound/Out', icon: '⚖️', unread: 0 },
  { id: 'security', name: 'Security & Turnstile Gates', icon: '🛡️', unread: 1 },
  { id: 'pit', name: 'Pit Haul Road & Heavy Plant', icon: '🚜', unread: 0 },
  { id: 'engineering', name: 'Engineering & Breakdown Dispatch', icon: '🔧', unread: 0 },
];

export const INITIAL_MESSAGES: MessageItem[] = [
  {
    id: 'm-1',
    sender: 'Weighbridge Outbound',
    avatar: '⚖️',
    channel: 'haulage',
    text: 'Coal Truck CT-01 [ABC 123 GP] Scania R500 weighed and cleared. Net load: 34.2 Tons.',
    time: '08:09',
    isSelf: false,
    status: 'read',
  },
  {
    id: 'm-2',
    sender: 'Main Turnstile Gate',
    avatar: '🛡️',
    channel: 'security',
    text: 'Employee Timothy Archer (EMP-001) scanned in successfully via RFID-E00401.',
    time: '08:12',
    isSelf: false,
    status: 'read',
  },
  {
    id: 'm-3',
    sender: 'You (Control Room)',
    avatar: '👤',
    channel: 'haulage',
    text: 'Acknowledged. Direct CT-02 to Scale 2 for tare weight check.',
    time: '08:15',
    isSelf: true,
    status: 'read',
  },
  {
    id: 'm-4',
    sender: 'Pit Access Gate 2',
    avatar: '🚜',
    channel: 'pit',
    text: 'Haul Truck CAT-777 (Off-Highway) cleared for pit entry. Calibration verified.',
    time: '08:22',
    isSelf: false,
    status: 'read',
  },
];
