'use client';

import { cn } from '@repo/ui/lib/utils';
import {
  CheckCheck,
  Columns2,
  GitBranch,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  QrCode,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useSplitWindow } from '@/hooks/useSplitWindow';

interface SplitWindowLayoutProps {
  children: React.ReactNode;
}

/* ─────────────────────────── Service Config ─────────────────────────── */

const SERVICE_META: Record<
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

/* ─────────────────────────── SplitWindowLayout ─────────────────────────── */

export const SplitWindowLayout = function SplitWindowLayout({ children }: SplitWindowLayoutProps) {
  const { isOpen, tabs, activeTabId, openTab, toggleTab, closeTab, activateTab, closeAll } =
    useSplitWindow();

  // Split-screen ratio state: "50" (split in half 50/50), "35" (compact 35%), "70" (wide 70%)
  const [splitRatio, setSplitRatio] = useState<'50' | '35' | '70'>('50');

  // Listen to custom window events dispatched from the navigation taskbar
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{
        service: 'github' | 'whatsapp';
        action?: 'open' | 'toggle';
      }>;
      if (customEvent.detail?.service) {
        if (customEvent.detail.action === 'toggle') {
          toggleTab(customEvent.detail.service);
        } else {
          openTab(customEvent.detail.service);
        }
      }
    };
    window.addEventListener('open-split-view', handleToggle);
    return () => window.removeEventListener('open-split-view', handleToggle);
  }, [openTab, toggleTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Layout width classes based on 50/50 split screen mode
  const getWorkspaceWidthClass = () => {
    if (!isOpen) return 'w-full pr-0';
    if (splitRatio === '50') return 'w-full lg:w-1/2 pr-0 lg:pr-2';
    if (splitRatio === '70') return 'w-full lg:w-[30%] pr-0 lg:pr-2';
    return 'w-full lg:w-[65%] pr-0 lg:pr-2';
  };

  const getSplitPaneWidthClass = () => {
    if (splitRatio === '50') return 'w-full lg:w-[calc(50%-0.75rem)]';
    if (splitRatio === '70') return 'w-full lg:w-[calc(70%-0.75rem)]';
    return 'w-full lg:w-[calc(35%-0.75rem)]';
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Left side: Main Website Workspace - Splits in half when open */}
      <div
        className={cn('min-w-0 transition-all duration-300 ease-in-out', getWorkspaceWidthClass())}
      >
        {children}
      </div>

      {/* Right side: Split window pane - 50% split screen docked side-by-side */}
      <div
        className={cn(
          'fixed top-16 right-2 bottom-2 z-dock',
          getSplitPaneWidthClass(),
          'liquid-glass-light flex flex-col overflow-hidden rounded-2xl border border-white/20 shadow-window',
          'transform transition-all duration-300 ease-glass',
          isOpen
            ? 'pointer-events-auto translate-x-0 opacity-100'
            : 'pointer-events-none translate-x-full opacity-0'
        )}
      >
        {/* Tab Bar & Split Controls */}
        <div className="flex shrink-0 items-center justify-between border-black/[0.06] border-b bg-black/[0.02] px-3 py-2 backdrop-blur-md">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {tabs.map((tab) => {
              const meta = SERVICE_META[tab.service];
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`tab-${tab.service}`}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold text-[11px]',
                    'select-none whitespace-nowrap transition-colors',
                    isActive
                      ? 'border border-black/[0.08] bg-white text-[var(--text-heading)] shadow-card'
                      : 'text-[var(--text-muted)] hover:bg-black/[0.03] hover:text-[var(--text-secondary)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => activateTab(tab.id)}
                    className="flex items-center gap-1.5"
                  >
                    {meta.Icon}
                    <span>{meta.shortLabel}</span>
                  </button>
                  <button
                    type="button"
                    data-testid={`close-tab-${tab.service}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/[0.08]"
                    aria-label={`Close ${meta.shortLabel} tab`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right Action Controls: Split Ratio Buttons & Global Close */}
          <div className="ml-2 flex shrink-0 items-center gap-1">
            <div className="mr-1 hidden items-center rounded-lg border border-black/[0.05] bg-black/[0.04] p-0.5 sm:flex">
              <button
                type="button"
                onClick={() => setSplitRatio('50')}
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 py-0.5 font-bold text-[10px] transition-all',
                  splitRatio === '50'
                    ? 'bg-white text-emerald-700 shadow-card'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
                title="Split 50% in half"
              >
                <Columns2 className="h-3 w-3" />
                <span>50:50</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio('70')}
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 py-0.5 font-bold text-[10px] transition-all',
                  splitRatio === '70'
                    ? 'bg-white text-emerald-700 shadow-card'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
                title="Wide Split (70%)"
              >
                <Maximize2 className="h-3 w-3" />
                <span>70%</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio('35')}
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 py-0.5 font-bold text-[10px] transition-all',
                  splitRatio === '35'
                    ? 'bg-white text-emerald-700 shadow-card'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
                title="Compact Sidebar (35%)"
              >
                <Minimize2 className="h-3 w-3" />
                <span>35%</span>
              </button>
            </div>

            {/* Global close button */}
            <button
              type="button"
              onClick={closeAll}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.04] transition-colors hover:bg-rose-50 hover:text-rose-600"
              aria-label="Close all tabs"
              title="Close split screen"
            >
              <X className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* Split Pane Contents */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeTab?.service === 'github' && <GitHubMockView />}
          {activeTab?.service === 'whatsapp' && <WhatsAppWebView />}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────── GitHub Mock View ─────────────────────────── */

function GitHubMockView() {
  const [tab, setTab] = useState<'code' | 'pulls' | 'issues'>('code');

  const commits = [
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-amber-500/20 border-b bg-amber-500/10 px-3 py-1.5 font-medium text-[11px] text-amber-800">
        <span>⚠️ Developer Preview — Simulated GitHub Integration</span>
        <span className="rounded bg-amber-200/60 px-1.5 py-0.5 font-bold font-mono text-[10px] uppercase">
          PROTOTYPE
        </span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-[13px]">
        {/* Branch & Status */}
        <div className="flex items-center justify-between rounded-xl border border-black/[0.05] bg-black/[0.02] p-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="font-semibold text-[var(--text-heading)]">master</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-[var(--accent-green)]">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>CI Quality Gate Passed</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-black/[0.06] border-b font-semibold text-[12px] text-[var(--text-muted)]">
          <button
            type="button"
            onClick={() => setTab('code')}
            className={cn(
              'border-b-2 px-3 pb-2 transition-all',
              tab === 'code'
                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                : 'border-transparent hover:text-[var(--text-secondary)]'
            )}
          >
            Commits
          </button>
          <button
            type="button"
            onClick={() => setTab('pulls')}
            className={cn(
              'border-b-2 px-3 pb-2 transition-all',
              tab === 'pulls'
                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                : 'border-transparent hover:text-[var(--text-secondary)]'
            )}
          >
            Pull Requests (1)
          </button>
          <button
            type="button"
            onClick={() => setTab('issues')}
            className={cn(
              'border-b-2 px-3 pb-2 transition-all',
              tab === 'issues'
                ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                : 'border-transparent hover:text-[var(--text-secondary)]'
            )}
          >
            Issues (2)
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-3">
          {tab === 'code' && (
            <div className="space-y-2.5">
              <p className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                Recent Commits
              </p>
              {commits.map((c) => (
                <div
                  key={c.hash}
                  className="flex flex-col gap-1 rounded-lg border border-black/[0.04] bg-black/[0.015] p-3 transition-colors hover:bg-black/[0.03]"
                >
                  <div className="flex items-center justify-between">
                    <span className="cursor-pointer font-semibold text-blue-600 hover:underline">
                      {c.hash}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">{c.date}</span>
                  </div>
                  <p className="text-[12px] text-[var(--text-heading)] leading-snug">{c.msg}</p>
                  <span className="text-[10px] text-[var(--text-muted)]">By {c.author}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'pulls' && (
            <div className="space-y-2 rounded-lg border border-black/[0.04] bg-black/[0.015] p-4">
              <div className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-green)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div>
                  <p className="font-bold text-[13px] text-[var(--text-heading)] leading-snug">
                    #105 Feature: Access Control Card Printing & 5-Entity QR RFID Generator
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Opened by Timothy • 13 unit tests passed
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'issues' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-black/[0.04] bg-black/[0.015] p-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="font-bold text-[var(--text-heading)] leading-snug">
                    #104 Magicard Neo 300 direct spooling & CUPS verification
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-[var(--text-muted)]">Resolved in #105</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── WhatsApp Web View ─────────────────────────── */

const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/';
const WHATSAPP_AUTO_ACK_DELAY_MS = 1200;

interface MessageItem {
  id: string;
  sender: string;
  avatar: string;
  channel: string;
  text: string;
  time: string;
  isSelf: boolean;
  status: 'sent' | 'delivered' | 'read';
}

const CHANNELS = [
  { id: 'haulage', name: 'Coal Haulage & CT Fleet', icon: '🚛', unread: 2 },
  { id: 'weighbridge', name: 'Weighbridge Inbound/Out', icon: '⚖️', unread: 0 },
  { id: 'security', name: 'Security & Turnstile Gates', icon: '🛡️', unread: 1 },
  { id: 'pit', name: 'Pit Haul Road & Heavy Plant', icon: '🚜', unread: 0 },
  { id: 'engineering', name: 'Engineering & Breakdown Dispatch', icon: '🔧', unread: 0 },
];

const INITIAL_MESSAGES: MessageItem[] = [
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

function WhatsAppWebView() {
  const [activeTab, setActiveTab] = useState<'chat' | 'link'>('chat');
  const [selectedChannel, setSelectedChannel] = useState('haulage');
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, []);

  const handleSendMessage = (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: 'You (Control Room)',
      avatar: '👤',
      channel: selectedChannel,
      text: content,
      time: timeStr,
      isSelf: true,
      status: 'delivered',
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Simulate auto-acknowledgement from station
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? { ...m, status: 'read' } : m)));
    }, WHATSAPP_AUTO_ACK_DELAY_MS);
  };

  const filteredMessages = messages.filter(
    (m) => m.channel === selectedChannel || m.channel === 'all'
  );
  const currentChannelObj = CHANNELS.find((c) => c.id === selectedChannel);

  return (
    <div className="relative flex h-full w-full select-none flex-col overflow-hidden bg-[#efeae2] text-slate-800">
      {/* ── WhatsApp Header Bar ── */}
      <div className="flex shrink-0 items-center justify-between bg-[#008069] px-3 py-2.5 text-white shadow-window">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
            <svg className="h-4 w-4 fill-current text-white" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.896c1.675.993 3.324 1.558 5.207 1.559 5.405 0 9.803-4.375 9.806-9.754.002-2.607-1.002-5.06-2.83-6.892-1.829-1.83-4.263-2.836-6.868-2.837-5.39 0-9.786 4.377-9.79 9.753-.001 2.03.535 3.738 1.555 5.262l-.994 3.63 3.74-.981z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-bold text-xs leading-none tracking-tight">
                WhatsApp Operations Chat
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-amber-600/90 px-1.5 py-0.5 font-medium text-[10px] text-amber-50">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                Prototype Demo
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10.5px] text-emerald-100/90">
              Simulated Field Dispatch • Non-Production •{' '}
              {currentChannelObj
                ? `${currentChannelObj.icon} ${currentChannelObj.name}`
                : 'Online Dispatch Network'}
            </p>
          </div>
        </div>

        {/* View Mode Toggle: Operations Chat vs QR Linking vs Open Web */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.open(WHATSAPP_WEB_URL, '_blank', 'noopener,noreferrer');
              }
            }}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-[#008069] text-[10.5px] shadow-card transition-all hover:bg-emerald-50 active:scale-95"
            title="Open WhatsApp Web in Login / Direct Tab"
            aria-label="Open WhatsApp Web in Login / Direct Tab"
          >
            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.896c1.675.993 3.324 1.558 5.207 1.559 5.405 0 9.803-4.375 9.806-9.754.002-2.607-1.002-5.06-2.83-6.892-1.829-1.83-4.263-2.836-6.868-2.837-5.39 0-9.786 4.377-9.79 9.753-.001 2.03.535 3.738 1.555 5.262l-.994 3.63 3.74-.981z" />
            </svg>
            <span>Open Web</span>
          </button>

          <div className="flex items-center rounded-lg border border-emerald-700/60 bg-emerald-800/80 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={cn(
                'flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-semibold text-[10.5px] transition-all',
                activeTab === 'chat'
                  ? 'bg-white text-emerald-800 shadow-card'
                  : 'text-emerald-200 hover:text-white'
              )}
            >
              <MessageSquare className="h-3 w-3" />
              <span>Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={cn(
                'flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-semibold text-[10.5px] transition-all',
                activeTab === 'link'
                  ? 'bg-white text-emerald-800 shadow-card'
                  : 'text-emerald-200 hover:text-white'
              )}
            >
              <QrCode className="h-3 w-3" />
              <span>Link QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-view: Chat Dispatch ── */}
      {activeTab === 'chat' && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Channel selector bar */}
          <div className="scrollbar-none flex shrink-0 items-center gap-1.5 overflow-x-auto border-black/[0.06] border-b bg-[#f0f2f5] px-2.5 py-1.5">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChannel(ch.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-medium text-[11px] transition-all',
                  selectedChannel === ch.id
                    ? 'bg-[#008069] font-semibold text-white shadow-card'
                    : 'border border-slate-200/80 bg-white text-slate-700 hover:bg-slate-100'
                )}
              >
                <span>{ch.icon}</span>
                <span>{ch.name}</span>
                {ch.unread > 0 && selectedChannel !== ch.id && (
                  <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 font-bold text-[9px] text-white">
                    {ch.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Messages Feed */}
          <div
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3"
            style={{
              backgroundImage:
                'radial-gradient(#d1d7db 1px, transparent 1px), radial-gradient(#d1d7db 1px, #efeae2 1px)',
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0, 12px 12px',
            }}
          >
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex max-w-[85%] items-end gap-1.5',
                  msg.isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'
                )}
              >
                {!msg.isSelf && (
                  <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs shadow-card">
                    {msg.avatar}
                  </div>
                )}
                <div
                  className={cn(
                    'relative rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed shadow-card',
                    msg.isSelf
                      ? 'rounded-tr-none border border-emerald-200/40 bg-[#d9fdd3] text-slate-800'
                      : 'rounded-tl-none border border-slate-200/60 bg-white text-slate-800'
                  )}
                >
                  {!msg.isSelf && (
                    <p className="mb-0.5 font-bold text-[#008069] text-[10px]">{msg.sender}</p>
                  )}
                  <p className="break-words">{msg.text}</p>
                  <div className="mt-1 flex select-none items-center justify-end gap-1 text-[9.5px] text-slate-500">
                    <span>{msg.time}</span>
                    {msg.isSelf && (
                      <CheckCheck
                        className={cn(
                          'h-3 w-3',
                          msg.status === 'read' ? 'text-sky-500' : 'text-slate-400'
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Operational Dispatch Quick Action Chips */}
          <div className="scrollbar-none flex shrink-0 items-center gap-1.5 overflow-x-auto border-black/[0.05] border-t bg-[#f0f2f5]/90 px-2 py-1.5">
            <span className="mr-0.5 shrink-0 font-bold text-[10px] text-slate-500 uppercase tracking-wider">
              Quick:
            </span>
            <button
              type="button"
              onClick={() =>
                handleSendMessage('🚛 Coal Truck CT-01 cleared Weighbridge Outbound Scale')
              }
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-[10.5px] text-slate-700 shadow-diffusion-sm transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              🚛 CT-01 Cleared
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('🚜 Pit Haul Truck CAT-777 inbound on Haul Road 2')}
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-[10.5px] text-slate-700 shadow-diffusion-sm transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              🚜 CAT-777 Inbound
            </button>
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  '🛡️ Security Alert: Contractor badge verification required at Boom A'
                )
              }
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-[10.5px] text-slate-700 shadow-diffusion-sm transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              🛡️ Gate Verification
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('⚖️ Weighbridge scale recalibrated and operational')}
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-[10.5px] text-slate-700 shadow-diffusion-sm transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              ⚖️ Scale Ready
            </button>
          </div>

          {/* Message Input Bar */}
          <div className="flex shrink-0 items-center gap-2 border-black/[0.06] border-t bg-[#f0f2f5] px-3 py-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
              title="Add Attachment"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Message ${currentChannelObj?.name || 'Operations Dispatch'}...`}
              className="flex-1 rounded-lg border border-slate-300/80 bg-white px-3 py-1.5 text-slate-900 text-xs placeholder:text-slate-400 focus:border-[#008069] focus:outline-none focus:ring-1 focus:ring-[#008069]"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all',
                inputText.trim()
                  ? 'cursor-pointer bg-[#008069] text-white shadow-card hover:scale-105 active:scale-95'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400'
              )}
              title="Send Message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Sub-view: Official Web Link & Pairing QR ── */}
      {activeTab === 'link' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-4">
          <div className="mx-auto w-full max-w-md space-y-4">
            <div className="space-y-1 text-center">
              <h3 className="font-bold text-slate-900 text-sm">
                Link Official WhatsApp on Workstation
              </h3>
              <p className="text-slate-500 text-xs">
                Connect your WhatsApp mobile app to this split screen for seamless communication
                without new tabs.
              </p>
            </div>

            {/* QR Card */}
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-card">
              <div className="group relative flex h-44 w-44 items-center justify-center rounded-xl border border-slate-300/80 bg-white p-2.5 shadow-inner">
                <svg
                  className="h-full w-full text-slate-800"
                  viewBox="0 0 100 100"
                  fill="currentColor"
                >
                  {/* Stylized high-density QR code representation */}
                  <rect x="5" y="5" width="25" height="25" fill="#111827" />
                  <rect x="10" y="10" width="15" height="15" fill="#ffffff" />
                  <rect x="13" y="13" width="9" height="9" fill="#111827" />
                  <rect x="70" y="5" width="25" height="25" fill="#111827" />
                  <rect x="75" y="10" width="15" height="15" fill="#ffffff" />
                  <rect x="78" y="13" width="9" height="9" fill="#111827" />
                  <rect x="5" y="70" width="25" height="25" fill="#111827" />
                  <rect x="10" y="75" width="15" height="15" fill="#ffffff" />
                  <rect x="13" y="78" width="9" height="9" fill="#111827" />
                  <rect x="35" y="10" width="8" height="8" fill="#111827" />
                  <rect x="48" y="10" width="6" height="14" fill="#111827" />
                  <rect x="58" y="5" width="6" height="8" fill="#111827" />
                  <rect x="35" y="24" width="12" height="6" fill="#111827" />
                  <rect x="10" y="36" width="14" height="6" fill="#111827" />
                  <rect x="30" y="36" width="6" height="18" fill="#111827" />
                  <rect x="42" y="36" width="16" height="6" fill="#111827" />
                  <rect x="64" y="36" width="12" height="6" fill="#111827" />
                  <rect x="82" y="36" width="12" height="12" fill="#111827" />
                  <rect x="10" y="48" width="6" height="12" fill="#111827" />
                  <rect x="22" y="48" width="12" height="6" fill="#111827" />
                  <rect x="42" y="48" width="8" height="18" fill="#111827" />
                  <rect x="56" y="48" width="18" height="6" fill="#111827" />
                  <rect x="80" y="54" width="14" height="6" fill="#111827" />
                  <rect x="36" y="70" width="8" height="12" fill="#111827" />
                  <rect x="48" y="70" width="18" height="6" fill="#111827" />
                  <rect x="72" y="70" width="6" height="18" fill="#111827" />
                  <rect x="84" y="70" width="10" height="12" fill="#111827" />
                  <rect x="36" y="86" width="18" height="8" fill="#111827" />
                  <rect x="60" y="82" width="6" height="12" fill="#111827" />
                  <rect x="82" y="86" width="12" height="8" fill="#111827" />
                </svg>
                {/* Center WhatsApp icon */}
                <div className="absolute inset-0 m-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] shadow-card">
                  <svg className="h-6 w-6 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.896c1.675.993 3.324 1.558 5.207 1.559 5.405 0 9.803-4.375 9.806-9.754.002-2.607-1.002-5.06-2.83-6.892-1.829-1.83-4.263-2.836-6.868-2.837-5.39 0-9.786 4.377-9.79 9.753-.001 2.03.535 3.738 1.555 5.262l-.994 3.63 3.74-.981z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 font-semibold text-[11px] text-emerald-700">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Pairing Code Active</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-slate-700 text-xs">
              <p className="font-semibold text-slate-900">Instructions:</p>
              <ol className="list-decimal space-y-1 pl-4 text-slate-600">
                <li>Open WhatsApp on your mobile phone</li>
                <li>
                  Tap <strong>Settings</strong> or <strong>Menu</strong> and select{' '}
                  <strong>Linked Devices</strong>
                </li>
                <li>
                  Tap <strong>Link a Device</strong> and point your camera at this QR code
                </li>
              </ol>
            </div>

            {/* Direct Web Frame Option */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div>
                <p className="font-bold text-slate-800 text-xs">Direct Web WhatsApp Login</p>
                <p className="text-[10.5px] text-slate-500">
                  Open web.whatsapp.com directly in a new dedicated window/tab
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open(WHATSAPP_WEB_URL, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="cursor-pointer rounded-lg bg-[#008069] px-3 py-1.5 font-semibold text-white text-xs shadow-card transition-all hover:bg-[#00705a]"
              >
                Launch web.whatsapp.com ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
