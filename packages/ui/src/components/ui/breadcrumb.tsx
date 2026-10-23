'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export type BreadcrumbType = 'text' | 'menu';

interface BreadcrumbContextValue {
  type: BreadcrumbType;
  separator: React.ReactNode;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue>({
  type: 'text',
  separator: '/',
});

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  type?: BreadcrumbType;
  separator?: React.ReactNode;
  children: React.ReactNode;
}

export const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ type = 'text', separator = '/', className, children, ...props }, ref) => {
    return (
      <BreadcrumbContext.Provider value={{ type, separator }}>
        <nav
          ref={ref}
          aria-label="Breadcrumbs"
          className={cn('flex items-center', className)}
          {...props}
        >
          <ol
            className={cn(
              'm-0 flex list-none flex-wrap items-center p-0',
              type === 'menu' ? 'gap-1.5' : 'gap-2 text-sm'
            )}
          >
            {React.Children.map(children, (child, index) => {
              if (!React.isValidElement(child)) return child;
              const isLast = index === React.Children.count(children) - 1;
              return (
                <li className="inline-flex items-center gap-2">
                  {child}
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'shrink-0 select-none',
                        type === 'menu'
                          ? 'mx-0.5 text-neutral-400 text-xs'
                          : 'font-mono text-neutral-400 text-xs'
                      )}
                    >
                      {separator}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </BreadcrumbContext.Provider>
    );
  }
);

Breadcrumb.displayName = 'Breadcrumb';

export interface BreadcrumbItemProps extends React.HTMLAttributes<HTMLElement> {
  active?: boolean;
  disabled?: boolean;
  href?: string;
  children: React.ReactNode;
}

export const BreadcrumbItem = React.forwardRef<HTMLElement, BreadcrumbItemProps>(
  ({ active = false, disabled = false, href, className, children, ...props }, ref) => {
    const { type } = React.useContext(BreadcrumbContext);

    let contentClasses = '';
    if (type === 'menu') {
      contentClasses = cn(
        'inline-flex select-none items-center justify-center rounded-md border px-2.5 py-1 font-medium text-xs transition-colors',
        active
          ? 'border-transparent bg-neutral-900 font-semibold text-white shadow-xs'
          : 'border-neutral-200/80 bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900',
        disabled && 'pointer-events-none cursor-not-allowed border-transparent opacity-40'
      );
    } else {
      contentClasses = cn(
        'inline-flex items-center text-sm transition-colors',
        active
          ? 'cursor-default font-semibold text-neutral-900'
          : 'text-neutral-500 hover:text-neutral-900',
        disabled && 'pointer-events-none cursor-not-allowed opacity-40'
      );
    }

    if (href && !disabled && !active) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={cn(contentClasses, className)}
          {...props}
        >
          {children}
        </a>
      );
    }

    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        aria-current={active ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        className={cn(contentClasses, className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

BreadcrumbItem.displayName = 'BreadcrumbItem';
