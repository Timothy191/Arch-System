"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export type BreadcrumbType = "text" | "menu";

interface BreadcrumbContextValue {
  type: BreadcrumbType;
  separator: React.ReactNode;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue>({
  type: "text",
  separator: "/",
});

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  type?: BreadcrumbType;
  separator?: React.ReactNode;
  children: React.ReactNode;
}

export const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ type = "text", separator = "/", className, children, ...props }, ref) => {
    return (
      <BreadcrumbContext.Provider value={{ type, separator }}>
        <nav
          ref={ref}
          aria-label="Breadcrumbs"
          className={cn("flex items-center", className)}
          {...props}
        >
          <ol
            className={cn(
              "flex items-center flex-wrap list-none p-0 m-0",
              type === "menu" ? "gap-1.5" : "gap-2 text-sm",
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
                        "select-none shrink-0",
                        type === "menu"
                          ? "text-neutral-400 dark:text-neutral-600 text-xs mx-0.5"
                          : "text-neutral-400 dark:text-neutral-500 font-mono text-xs",
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
  },
);

Breadcrumb.displayName = "Breadcrumb";

export interface BreadcrumbItemProps extends React.HTMLAttributes<HTMLElement> {
  active?: boolean;
  disabled?: boolean;
  href?: string;
  children: React.ReactNode;
}

export const BreadcrumbItem = React.forwardRef<HTMLElement, BreadcrumbItemProps>(
  ({ active = false, disabled = false, href, className, children, ...props }, ref) => {
    const { type } = React.useContext(BreadcrumbContext);

    let contentClasses = "";
    if (type === "menu") {
      contentClasses = cn(
        "inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-medium transition-colors border select-none",
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-transparent shadow-xs font-semibold"
          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700/60 hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 hover:text-neutral-900 dark:hover:text-white",
        disabled && "opacity-40 pointer-events-none cursor-not-allowed border-transparent",
      );
    } else {
      contentClasses = cn(
        "inline-flex items-center text-sm transition-colors",
        active
          ? "text-neutral-900 dark:text-neutral-100 font-semibold cursor-default"
          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100",
        disabled && "opacity-40 pointer-events-none cursor-not-allowed",
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
        aria-current={active ? "page" : undefined}
        aria-disabled={disabled ? "true" : undefined}
        className={cn(contentClasses, className)}
        {...props}
      >
        {children}
      </span>
    );
  },
);

BreadcrumbItem.displayName = "BreadcrumbItem";
