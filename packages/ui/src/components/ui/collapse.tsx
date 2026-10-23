'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { Logo } from '../Logo';

interface CollapseGroupContextValue {
  multiple?: boolean;
  activeKeys: Set<string>;
  toggleKey: (key: string) => void;
}

const CollapseGroupContext = React.createContext<CollapseGroupContextValue | null>(null);

export interface CollapseGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  multiple?: boolean;
  children: React.ReactNode;
}

export function CollapseGroup({
  multiple = false,
  className,
  children,
  ...props
}: CollapseGroupProps) {
  const [activeKeys, setActiveKeys] = React.useState<Set<string>>(new Set());

  const toggleKey = React.useCallback(
    (key: string) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          if (!multiple) {
            next.clear();
          }
          next.add(key);
        }
        return next;
      });
    },
    [multiple]
  );

  return (
    <CollapseGroupContext.Provider value={{ multiple, activeKeys, toggleKey }}>
      <div
        className={cn('divide-y divide-neutral-200 border-neutral-200 border-y', className)}
        {...props}
      >
        {children}
      </div>
    </CollapseGroupContext.Provider>
  );
}

export interface CollapseProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'onChange'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  size?: 'small' | 'medium';
  onChange?: (expanded: boolean) => void;
  children: React.ReactNode;
}

export const Collapse = React.forwardRef<HTMLDivElement, CollapseProps>(
  (
    {
      title,
      subtitle,
      defaultExpanded = false,
      expanded: controlledExpanded,
      size = 'medium',
      onChange,
      className,
      children,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const collapseId = id ?? generatedId;
    const contentId = `${collapseId}-content`;

    const group = React.useContext(CollapseGroupContext);
    const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState(defaultExpanded);

    // If inside CollapseGroup, respect group activeKeys
    const isExpanded = group
      ? group.activeKeys.has(collapseId)
      : controlledExpanded !== undefined
        ? controlledExpanded
        : uncontrolledExpanded;

    React.useEffect(() => {
      if (group?.toggleKey && defaultExpanded) {
        group.toggleKey(collapseId);
      }
    }, [group, defaultExpanded, collapseId]);

    const handleToggle = () => {
      if (group) {
        group.toggleKey(collapseId);
        onChange?.(!isExpanded);
      } else if (controlledExpanded === undefined) {
        setUncontrolledExpanded((prev) => {
          const next = !prev;
          onChange?.(next);
          return next;
        });
      } else {
        onChange?.(!controlledExpanded);
      }
    };

    return (
      <div ref={ref} className={cn('w-full transition-colors', className)} {...props}>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={handleToggle}
          className={cn(
            'flex w-full select-none items-center justify-between text-left transition-colors',
            size === 'small' ? 'py-2.5 font-medium text-xs' : 'py-4 font-semibold text-sm',
            'text-neutral-900 hover:text-neutral-600',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900'
          )}
        >
          <div className="flex flex-col pr-4">
            <span className="leading-snug">{title}</span>
            {subtitle && (
              <span className="mt-0.5 font-normal text-neutral-500 text-xs">{subtitle}</span>
            )}
          </div>
          <Logo
            variant="gold"
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out',
              isExpanded ? 'rotate-0' : 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>

        {isExpanded && (
          <div
            id={contentId}
            role="region"
            className={cn(
              'text-neutral-600 transition-all',
              size === 'small' ? 'pb-2.5 text-xs' : 'pb-4 text-sm'
            )}
          >
            {children}
          </div>
        )}
      </div>
    );
  }
);

Collapse.displayName = 'Collapse';
