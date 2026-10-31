'use client';

import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { analytics, fetchClient } from '@repo/utils/client';
import { Bug, LifeBuoy, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

interface FeedbackWidgetProps {
  variant?: 'header' | 'floating';
}

type FeedbackCategory = 'bug' | 'feature' | 'general' | 'support';

interface FeedbackCategoryItem {
  value: FeedbackCategory;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEFAULT_FEEDBACK_CATEGORY: FeedbackCategoryItem = {
  value: 'bug',
  label: 'Bug Report',
  hint: 'Report a fault, UI regression, or telemetry discrepancy',
  icon: Bug,
};

const FEEDBACK_CATEGORIES: readonly FeedbackCategoryItem[] = [
  DEFAULT_FEEDBACK_CATEGORY,
  {
    value: 'feature',
    label: 'Feature',
    hint: 'Request an operational module or workflow enhancement',
    icon: Sparkles,
  },
  {
    value: 'general',
    label: 'Feedback',
    hint: 'Share general portal or shift usability observations',
    icon: MessageSquare,
  },
  {
    value: 'support',
    label: 'Ops Support',
    hint: 'Request technical assistance from Arch Systems dispatch',
    icon: LifeBuoy,
  },
];

// AGENT-TRACE: Redesigned FeedbackWidget to match Arch OS light-mode liquid-glass design system
// (Logo emblem, Space Grotesk display typography, tactile category pills, monospace telemetry badges, Sonner toast).
export function FeedbackWidget({ variant = 'header' }: FeedbackWidgetProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory: FeedbackCategoryItem =
    FEEDBACK_CATEGORIES.find((cat) => cat.value === type) ?? DEFAULT_FEEDBACK_CATEGORY;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && message.trim()) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);

    analytics.track({
      eventName: 'User Feedback Submitted',
      properties: { type, messageLength: message.length },
    });

    await fetchClient.post('/api/feedback', { type, message }).catch(() => {});

    setSubmitting(false);
    setMessage('');
    setIsOpen(false);
    toast.success('Feedback transmitted to Arch Support Desk');
  };

  const renderModalCard = (positionClass: string) => (
    <div
      role="dialog"
      aria-label="Send Feedback & Support"
      onKeyDown={handleKeyDown}
      data-testid="feedback-widget-popover"
      className={cn(
        positionClass,
        'liquid-glass-light z-popover w-[340px] bg-white/95 backdrop-blur-2xl sm:w-[360px]',
        'flex flex-col gap-3.5 rounded-2xl border border-white/60 p-4 shadow-window ring-1 ring-black/[0.08]',
        'fade-in zoom-in-95 animate-in duration-150'
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 border-black/[0.07] border-b pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/12 shadow-2xs">
            <Logo className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-anurati font-bold text-[var(--text-heading)] text-xs uppercase tracking-[0.055em]">
                Feedback &amp; Support
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-green/20 bg-accent-green/10 px-1.5 py-0.5 font-mono font-semibold text-[9px] text-accent-green">
                <span className="h-1 w-1 animate-pulse rounded-full bg-accent-green" />
                DESK LIVE
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-muted)]">
              {'ARCH-OS // OPERATOR DISPATCH CHANNEL'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close feedback panel"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Category Selector Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              Dispatch Category
            </span>
            <span className="font-medium font-mono text-[10px] text-[var(--accent-blue)]">
              {selectedCategory.label}
            </span>
          </div>
          <div
            className="grid grid-cols-2 gap-1.5"
            role="radiogroup"
            aria-label="Feedback category"
          >
            {FEEDBACK_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = type === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setType(cat.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left font-medium text-xs transition-all duration-150',
                    isSelected
                      ? 'border-[var(--accent-blue)]/45 bg-[var(--accent-blue)]/12 text-[var(--text-heading)] shadow-2xs ring-1 ring-[var(--accent-blue)]/25'
                      : 'border-black/[0.06] bg-black/[0.025] text-[var(--text-secondary)] hover:bg-black/[0.05] hover:text-[var(--text-heading)]'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-colors',
                      isSelected ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)]'
                    )}
                  />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[var(--text-muted)] leading-snug">
            {selectedCategory.hint}
          </p>
        </div>

        {/* Message Textarea */}
        <div className="space-y-1">
          <label
            htmlFor="arch-feedback-message"
            className="block font-mono font-semibold text-[10px] text-[var(--text-muted)] uppercase tracking-wider"
          >
            Operational Details
          </label>
          <textarea
            id="arch-feedback-message"
            placeholder="Describe your issue, telemetry anomaly, or feature request…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            className="min-h-[84px] w-full resize-none rounded-xl border border-black/[0.08] bg-black/[0.025] px-3 py-2 text-[var(--text-heading)] text-xs transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
          />
        </div>

        {/* Footer / Submit Controls */}
        <div className="flex items-center justify-between border-black/[0.06] border-t pt-1">
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--text-muted)]">
            <kbd className="rounded border border-black/[0.08] bg-black/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-secondary)]">
              ⌘+Enter
            </kbd>
            <span>to submit</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-8 rounded-lg border border-transparent bg-black/[0.04] px-3 font-medium text-[var(--text-secondary)] text-xs transition-all hover:bg-black/[0.08] hover:text-[var(--text-heading)] active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 font-semibold text-white text-xs shadow-xs transition-all hover:bg-[var(--accent-blue)]/90 active:scale-95 disabled:pointer-events-none disabled:opacity-45"
            >
              <Send className="h-3 w-3" />
              <span>{submitting ? 'Sending…' : 'Submit'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  if (variant === 'header') {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={cn(
            'gold-steel-border gold-steel-border-slim flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium text-xs',
            'bg-[var(--material-ultra-thin)] backdrop-blur-md hover:bg-[var(--material-thin)]',
            'border border-white/20 text-[var(--text-heading)] shadow-diffusion-sm',
            'transition-all hover:scale-105 active:scale-95',
            isOpen && 'bg-[var(--material-thin)] ring-1 ring-[var(--accent-blue)]/45'
          )}
          title="Feedback & Support"
        >
          <Logo className="h-3 w-3 shrink-0 text-[var(--accent-blue)]" />
          <span className="hidden sm:inline">Support</span>
        </button>

        {isOpen && renderModalCard('fixed top-12 right-6')}
      </div>
    );
  }

  if (!isVisible) {
    return (
      <div className="fixed right-4 bottom-4 z-popover">
        <button
          type="button"
          onClick={() => setIsVisible(true)}
          className="liquid-glass-light inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/90 px-3 font-medium text-[var(--text-heading)] text-xs opacity-80 shadow-diffusion-md backdrop-blur-md transition-all hover:opacity-100"
          title="Show Feedback Widget"
        >
          <Logo className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
          <span>Feedback</span>
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="fixed right-4 bottom-4 z-popover flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="liquid-glass-light inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.08] bg-white/95 px-3.5 font-semibold text-[var(--text-heading)] text-xs shadow-diffusion-md backdrop-blur-md transition-all hover:border-[var(--accent-blue)]/40"
        >
          <Logo className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
          <span>Feedback / Support</span>
        </button>
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/85 text-[var(--text-muted)] backdrop-blur-md transition-colors hover:bg-black/5 hover:text-[var(--text-heading)]"
          title="Hide Feedback Widget"
          aria-label="Hide Feedback Widget"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return renderModalCard('fixed bottom-4 right-4');
}
