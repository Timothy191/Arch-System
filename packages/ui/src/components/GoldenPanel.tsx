'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { type HTMLAttributes, type ReactNode, useId, useState } from 'react';
import { cn } from '../lib/utils';
import { Logo } from './Logo';

const goldenPanelVariants = cva(
  'liquid-glass-light gold-steel-border gold-steel-border-slim relative isolate overflow-hidden rounded-card border border-white/30 backdrop-blur-md transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default: 'bg-[var(--material-regular)] shadow-diffusion-sm',
        elevated: 'bg-[var(--material-thick)] shadow-glass-depth',
        interactive:
          'bg-[var(--material-regular)] shadow-diffusion-sm hover:-translate-y-0.5 hover:shadow-card-hover',
        subtle: 'bg-[var(--material-thin)] shadow-card',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const HEADER_BAR_CLASS =
  'flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between';
const HEADER_SEPARATOR_CLASS =
  'h-px w-full bg-gradient-to-r from-[var(--accent-gold)]/55 via-[var(--accent-gold)]/25 to-transparent';
const HEADER_ITEM_BASE_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/50';
const HEADER_ITEM_ACTIVE_CLASS =
  'gold-steel-border gold-steel-border-slim border-[var(--accent-gold)]/60 bg-[var(--accent-gold-subtle)] font-semibold text-[var(--text-heading)] shadow-2xs';
const HEADER_ITEM_IDLE_CLASS =
  'border-[var(--border-default)] bg-white/80 text-[var(--text-secondary)] hover:border-[var(--accent-gold)]/45 hover:text-[var(--text-heading)]';
const COLLAPSE_BTN_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-white/85 px-2.5 py-1.5 font-medium text-[var(--text-secondary)] text-xs transition-colors hover:border-[var(--accent-gold)]/50 hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/50';

export interface GoldenPanelHeaderItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly badge?: string | number;
  readonly panelContent?: ReactNode;
}

export interface GoldenPanelProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof goldenPanelVariants> {
  readonly title?: ReactNode;
  readonly headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
  readonly subtitle?: ReactNode;
  readonly icon?: ReactNode;
  readonly showLogo?: boolean;
  readonly statusBadge?: ReactNode;
  readonly actions?: ReactNode;
  readonly headerItems?: readonly GoldenPanelHeaderItem[];
  readonly activeHeaderItemId?: string | null;
  readonly onSelectHeaderItem?: (id: string | null) => void;
  readonly collapsible?: boolean;
  readonly defaultExpanded?: boolean;
  readonly contentClassName?: string;
  readonly noBodyPadding?: boolean;
  readonly children?: ReactNode;
}

export function GoldenPanel({
  title,
  headingLevel = 'h3',
  subtitle,
  icon,
  showLogo = false,
  statusBadge,
  actions,
  headerItems,
  activeHeaderItemId,
  onSelectHeaderItem,
  collapsible = false,
  defaultExpanded = true,
  variant = 'default',
  className,
  contentClassName,
  noBodyPadding = false,
  children,
  ...rest
}: GoldenPanelProps) {
  const prefersReduced = useReducedMotion();
  const panelId = useId();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [internalActiveId, setInternalActiveId] = useState<string | null>(null);

  const isControlledItem = activeHeaderItemId !== undefined;
  const resolvedActiveItemId = isControlledItem ? activeHeaderItemId : internalActiveId;

  const handleToggleItem = (itemId: string) => {
    const nextId = resolvedActiveItemId === itemId ? null : itemId;
    if (!isControlledItem) {
      setInternalActiveId(nextId);
    }
    onSelectHeaderItem?.(nextId);
  };

  const activeItem = headerItems?.find((item) => item.id === resolvedActiveItemId) ?? null;
  const HeadingTag = headingLevel;
  const hasHeader = Boolean(
    title || subtitle || actions || statusBadge || (headerItems && headerItems.length > 0)
  );
  const hasBody = children !== undefined && children !== null;

  return (
    <div className={cn(goldenPanelVariants({ variant }), className)} {...rest}>
      {hasHeader && (
        <div className="bg-white/45">
          <div className={HEADER_BAR_CLASS}>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                {showLogo && <Logo className="h-6 w-6 shrink-0 text-accent-gold" />}
                {icon && <span className="shrink-0 text-[var(--text-heading)]">{icon}</span>}
                {title && (
                  <HeadingTag
                    className={cn(
                      'font-bold text-[var(--text-heading)] tracking-tight',
                      headingLevel === 'h1' || headingLevel === 'h2'
                        ? 'text-xl sm:text-2xl'
                        : 'text-lg'
                    )}
                  >
                    {title}
                  </HeadingTag>
                )}
                {statusBadge}
              </div>
              {subtitle && <p className="text-[var(--text-secondary)] text-sm">{subtitle}</p>}
            </div>

            {(actions || collapsible || (headerItems && headerItems.length > 0)) && (
              <div className="flex flex-wrap items-center gap-2">
                {headerItems && headerItems.length > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="toolbar"
                    aria-label="Header panel options"
                  >
                    {headerItems.map((item) => {
                      const isSelected = resolvedActiveItemId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-expanded={isSelected}
                          aria-controls={`${panelId}-drawer`}
                          onClick={() => handleToggleItem(item.id)}
                          className={cn(
                            HEADER_ITEM_BASE_CLASS,
                            isSelected ? HEADER_ITEM_ACTIVE_CLASS : HEADER_ITEM_IDLE_CLASS
                          )}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                          {item.badge !== undefined && (
                            <span className="rounded-full bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-heading)]">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {actions}

                {collapsible && hasBody && (
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`${panelId}-body`}
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className={COLLAPSE_BTN_CLASS}
                  >
                    <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={HEADER_SEPARATOR_CLASS} role="separator" aria-orientation="horizontal" />

          <AnimatePresence initial={false}>
            {activeItem?.panelContent && (
              <motion.div
                id={`${panelId}-drawer`}
                key={activeItem.id}
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="border-[var(--accent-gold-border)] border-b bg-white/75 px-5 py-4"
              >
                {activeItem.panelContent}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {hasBody && isExpanded && (
        <motion.div
          id={`${panelId}-body`}
          initial={collapsible && !prefersReduced ? { opacity: 0, y: -4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className={cn(!noBodyPadding && 'p-5', contentClassName)}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}
