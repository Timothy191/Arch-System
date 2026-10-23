'use client';

import { Info } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface DescriptionProps
  extends Omit<React.HTMLAttributes<HTMLDListElement>, 'title' | 'content'> {
  title: React.ReactNode;
  content: React.ReactNode;
  tooltip?: string;
  right?: boolean;
  ellipsis?: boolean;
}

export function Description({
  title,
  content,
  tooltip,
  right = false,
  ellipsis = false,
  className,
  ...props
}: DescriptionProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <dl
      className={cn(
        'flex font-sans text-sm',
        right ? 'flex-row items-baseline justify-between gap-4' : 'flex-col gap-1',
        className
      )}
      {...props}
    >
      <dt
        className={cn(
          'flex select-none items-center gap-1.5 font-medium text-neutral-500 text-xs',
          right && 'shrink-0'
        )}
      >
        <span>{title}</span>
        {tooltip && (
          <span
            className="relative inline-flex items-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            tabIndex={0}
            role="button"
            aria-label={`More information about ${typeof title === 'string' ? title : 'this field'}`}
          >
            <Info className="h-3.5 w-3.5 cursor-help text-neutral-400 transition-colors hover:text-neutral-600" />
            {showTooltip && (
              <span
                role="tooltip"
                className="fade-in-0 pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-xs -translate-x-1/2 animate-in rounded-md bg-neutral-900 px-2 py-1 text-neutral-100 text-xs shadow-md duration-150"
              >
                {tooltip}
              </span>
            )}
          </span>
        )}
      </dt>
      <dd
        className={cn(
          'm-0 text-neutral-900 text-sm',
          right && 'text-right',
          ellipsis && 'max-w-full truncate'
        )}
      >
        {content}
      </dd>
    </dl>
  );
}
