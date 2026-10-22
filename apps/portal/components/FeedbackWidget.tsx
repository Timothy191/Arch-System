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
// (Logo emblem, Anurati display typography, tactile category pills, monospace telemetry badges, Sonner toast).
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
        'z-popover w-[340px] sm:w-[360px] liquid-glass-light bg-white/95 backdrop-blur-2xl',
        'border border-white/60 ring-1 ring-black/[0.08] rounded-2xl shadow-window p-4 flex flex-col gap-3.5',
        'animate-in fade-in zoom-in-95 duration-150'
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-black/[0.07]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[var(--accent-blue)]/12 border border-[var(--accent-blue)]/25 flex items-center justify-center shrink-0 shadow-2xs">
            <Logo className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className="font-anurati uppercase tracking-[0.08em] text-xs font-bold text-[var(--text-heading)] truncate"
                style={{
                  fontFamily:
                    "'Anurati', var(--font-outfit), var(--font-sans), system-ui, sans-serif",
                }}
              >
                Feedback &amp; Support
              </h3>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-green/10 border border-accent-green/20 text-[9px] font-mono font-semibold text-accent-green">
                <span className="w-1 h-1 rounded-full bg-accent-green animate-pulse" />
                DESK LIVE
              </span>
            </div>
            <p className="text-[10px] font-mono text-[var(--text-muted)] truncate mt-0.5">
              {'ARCH-OS // OPERATOR DISPATCH CHANNEL'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close feedback panel"
          className="h-6 w-6 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-black/[0.05] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Category Selector Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold">
              Dispatch Category
            </span>
            <span className="text-[10px] font-mono text-[var(--accent-blue)] font-medium">
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
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left text-xs font-medium transition-all duration-150',
                    isSelected
                      ? 'bg-[var(--accent-blue)]/12 border-[var(--accent-blue)]/45 text-[var(--text-heading)] shadow-2xs ring-1 ring-[var(--accent-blue)]/25'
                      : 'bg-black/[0.025] border-black/[0.06] text-[var(--text-secondary)] hover:bg-black/[0.05] hover:text-[var(--text-heading)]'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-3.5 h-3.5 shrink-0 transition-colors',
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
            className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold block"
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
            className="w-full min-h-[84px] rounded-xl border border-black/[0.08] bg-black/[0.025] focus:bg-white px-3 py-2 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 transition-all resize-none"
          />
        </div>

        {/* Footer / Submit Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-black/[0.06]">
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-mono">
            <kbd className="px-1.5 py-0.5 rounded bg-black/[0.04] border border-black/[0.08] text-[9px] font-mono text-[var(--text-secondary)]">
              ⌘+Enter
            </kbd>
            <span>to submit</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-8 px-3 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] bg-black/[0.04] hover:bg-black/[0.08] border border-transparent transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 disabled:opacity-45 disabled:pointer-events-none shadow-xs transition-all active:scale-95"
            >
              <Send className="w-3 h-3" />
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
            'flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium rounded-full',
            'bg-[var(--material-ultra-thin)] hover:bg-[var(--material-thin)] backdrop-blur-md',
            'border border-white/20 text-[var(--text-heading)] shadow-diffusion-sm',
            'transition-all hover:scale-105 active:scale-95',
            isOpen && 'ring-1 ring-[var(--accent-blue)]/45 bg-[var(--material-thin)]'
          )}
          title="Feedback & Support"
        >
          <Logo className="w-3 h-3 text-[var(--accent-blue)] shrink-0" />
          <span className="hidden sm:inline">Support</span>
        </button>

        {isOpen && renderModalCard('fixed top-12 right-6')}
      </div>
    );
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-popover">
        <button
          type="button"
          onClick={() => setIsVisible(true)}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full shadow-diffusion-md liquid-glass-light bg-white/90 backdrop-blur-md border border-black/[0.08] opacity-80 hover:opacity-100 transition-all text-xs font-medium text-[var(--text-heading)]"
          title="Show Feedback Widget"
        >
          <Logo className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          <span>Feedback</span>
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-popover flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 h-9 rounded-full shadow-diffusion-md liquid-glass-light bg-white/95 backdrop-blur-md border border-black/[0.08] text-xs font-semibold text-[var(--text-heading)] hover:border-[var(--accent-blue)]/40 transition-all"
        >
          <Logo className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          <span>Feedback / Support</span>
        </button>
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="rounded-full w-7 h-7 bg-white/85 backdrop-blur-md border border-black/10 hover:bg-black/5 text-[var(--text-muted)] hover:text-[var(--text-heading)] flex items-center justify-center transition-colors"
          title="Hide Feedback Widget"
          aria-label="Hide Feedback Widget"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return renderModalCard('fixed bottom-4 right-4');
}
