'use client';

import { cn } from '@repo/ui/lib/utils';
import { Columns2, Maximize2, Minimize2, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useSplitWindow } from '@/hooks/useSplitWindow';
import { GitHubMockView } from './SplitWindowGitHubView';
import { WhatsAppWebView } from './SplitWindowWhatsAppView';
import { SERVICE_META } from './split-window-data';

interface SplitWindowLayoutProps {
  children: React.ReactNode;
}

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
