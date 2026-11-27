'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export interface ProfessionalDropdownItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly badge?: string | number;
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly dividerBefore?: boolean;
  readonly onSelect?: () => void;
  readonly subItems?: readonly ProfessionalDropdownItem[];
}

export interface ProfessionalDropdownMenuProps {
  readonly triggerLabel: string;
  readonly triggerIcon?: ReactNode;
  readonly triggerBadge?: string | number;
  readonly items: readonly ProfessionalDropdownItem[];
  readonly triggerMode?: 'click' | 'hover' | 'both';
  readonly align?: 'start' | 'center' | 'end';
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly testId?: string;
}

const TRIGGER_BTN_CLASS =
  'gold-steel-border gold-steel-border-slim inline-flex min-h-[36px] items-center justify-between gap-2 rounded-lg border border-[var(--accent-gold-border)] bg-white/90 px-3.5 py-1.5 font-semibold text-[var(--text-heading)] text-xs shadow-2xs transition-all hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60 data-[state=open]:bg-white';

const MENU_CONTENT_CLASS =
  'gold-steel-border gold-steel-border-slim z-50 min-w-[14rem] overflow-hidden rounded-xl border border-[var(--accent-gold-border)] bg-white/95 p-1.5 text-[var(--text-heading)] shadow-window backdrop-blur-xl data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95';

const MENU_ITEM_CLASS =
  'relative flex cursor-pointer select-none items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs outline-none transition-colors hover:bg-[var(--accent-gold-subtle)] focus:bg-[var(--accent-gold-subtle)] focus:text-[var(--text-heading)] data-[disabled]:pointer-events-none data-[disabled]:opacity-45';

const SUB_TRIGGER_CLASS =
  'flex cursor-pointer select-none items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs outline-none transition-colors hover:bg-[var(--accent-gold-subtle)] focus:bg-[var(--accent-gold-subtle)] data-[state=open]:bg-[var(--accent-gold-subtle)] data-[disabled]:pointer-events-none data-[disabled]:opacity-45';

const SEPARATOR_CLASS = 'my-1 h-px bg-[var(--border-default)]';

const HOVER_OPEN_DELAY_MS = 65;
const HOVER_CLOSE_DELAY_MS = 160;

function renderMenuNode(item: ProfessionalDropdownItem): ReactNode {
  return (
    <div key={item.id}>
      {item.dividerBefore && <DropdownMenuPrimitive.Separator className={SEPARATOR_CLASS} />}
      {item.subItems && item.subItems.length > 0 ? (
        <DropdownMenuPrimitive.Sub>
          <DropdownMenuPrimitive.SubTrigger
            disabled={item.disabled}
            className={cn(
              SUB_TRIGGER_CLASS,
              item.selected && 'bg-[var(--accent-gold-subtle)] font-semibold'
            )}
          >
            <span className="flex items-center gap-2">
              {item.icon && <span className="shrink-0 text-accent-gold">{item.icon}</span>}
              <span>{item.label}</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          </DropdownMenuPrimitive.SubTrigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.SubContent sideOffset={6} className={MENU_CONTENT_CLASS}>
              {item.subItems.map((child) => renderMenuNode(child))}
            </DropdownMenuPrimitive.SubContent>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Sub>
      ) : (
        <DropdownMenuPrimitive.Item
          disabled={item.disabled}
          onSelect={() => item.onSelect?.()}
          className={cn(
            MENU_ITEM_CLASS,
            item.selected && 'bg-[var(--accent-gold-subtle)] font-semibold'
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {item.icon && <span className="shrink-0 text-accent-gold">{item.icon}</span>}
            <span className="truncate">
              {item.label}
              {item.description && (
                <span className="block font-normal text-[11px] text-[var(--text-muted)]">
                  {item.description}
                </span>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {item.badge !== undefined && (
              <span className="rounded-full bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                {item.badge}
              </span>
            )}
            {item.selected && (
              <Check
                className="h-3.5 w-3.5 text-accent-gold"
                aria-label="Selected"
                data-testid={`dropdown-selected-${item.id}`}
              />
            )}
          </span>
        </DropdownMenuPrimitive.Item>
      )}
    </div>
  );
}

/**
 * WCAG 2.1 AA Professional Dropdown Menu supporting click + hover triggers,
 * multi-level nested sub-menus, full roving keyboard navigation, and <100ms response.
 */
export function ProfessionalDropdownMenu({
  triggerLabel,
  triggerIcon,
  triggerBadge,
  items,
  triggerMode = 'both',
  align = 'start',
  ariaLabel,
  className,
  contentClassName,
  testId = 'professional-dropdown-trigger',
}: ProfessionalDropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supportsHover = triggerMode === 'hover' || triggerMode === 'both';

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const handlePointerEnter = () => {
    if (!supportsHover) return;
    clearTimers();
    openTimerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, HOVER_OPEN_DELAY_MS);
  };

  const handlePointerLeave = () => {
    if (!supportsHover) return;
    clearTimers();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  };

  return (
    <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          data-testid={testId}
          aria-label={ariaLabel ?? triggerLabel}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={() => {
            if (triggerMode === 'hover') return;
            clearTimers();
            setIsOpen((prev) => !prev);
          }}
          className={cn(TRIGGER_BTN_CLASS, className)}
        >
          <span className="flex items-center gap-1.5">
            {triggerIcon && <span className="text-accent-gold">{triggerIcon}</span>}
            <span>{triggerLabel}</span>
            {triggerBadge !== undefined && (
              <span className="rounded-full bg-[var(--accent-gold-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-heading)]">
                {triggerBadge}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-150',
              isOpen && 'rotate-180 text-accent-gold'
            )}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={6}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          className={cn(MENU_CONTENT_CLASS, contentClassName)}
        >
          {items.map((item) => renderMenuNode(item))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
