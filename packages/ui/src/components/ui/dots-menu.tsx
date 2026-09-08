"use client";

import { MoreHorizontal } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

interface DotsMenuContextType {
  close: () => void;
}

const DotsMenuContext = React.createContext<DotsMenuContextType | null>(null);

function useDotsMenu() {
  return React.useContext(DotsMenuContext);
}

export interface DotsMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  iconSize?: number;
  disabled?: boolean;
  buttonAriaLabel?: string;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}

export function DotsMenu({
  iconSize = 16,
  disabled = false,
  buttonAriaLabel = "More options",
  align = "end",
  children,
  className,
  ...props
}: DotsMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const alignClasses =
    align === "start" ? "left-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "right-0";

  return (
    <DotsMenuContext.Provider value={{ close }}>
      <div
        ref={containerRef}
        className={cn("relative inline-block text-left", className)}
        {...props}
      >
        <button
          type="button"
          disabled={disabled}
          aria-label={buttonAriaLabel}
          aria-haspopup="true"
          aria-expanded={isOpen}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "inline-flex items-center justify-center rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            disabled && "cursor-not-allowed opacity-50 pointer-events-none"
          )}
        >
          <MoreHorizontal style={{ width: iconSize, height: iconSize }} />
        </button>

        {isOpen && (
          <div
            role="menu"
            className={cn(
              "absolute top-[calc(100%+4px)] z-50 min-w-[160px] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 animate-in fade-in-0 zoom-in-95 duration-100",
              alignClasses
            )}
          >
            {children}
          </div>
        )}
      </div>
    </DotsMenuContext.Provider>
  );
}

export interface DotsMenuItemProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onClick" | "prefix"> {
  disabled?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  href?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}

export function DotsMenuItem({
  disabled = false,
  destructive = false,
  onClick,
  href,
  prefix,
  suffix,
  children,
  className,
  ...props
}: DotsMenuItemProps) {
  const context = useDotsMenu();

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    context?.close();
  };

  const sharedClasses = cn(
    "flex w-full cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-xs outline-none transition-colors",
    destructive
      ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100",
    disabled && "pointer-events-none opacity-40 cursor-not-allowed",
    className
  );

  const content = (
    <>
      {prefix && <span className="mr-2 flex shrink-0 items-center text-neutral-400">{prefix}</span>}
      <span className="flex-1 truncate">{children}</span>
      {suffix && (
        <span className="ml-2 flex shrink-0 items-center text-xs text-neutral-400">{suffix}</span>
      )}
    </>
  );

  if (href && !disabled) {
    return (
      <a
        href={href}
        role="menuitem"
        onClick={handleClick}
        className={sharedClasses}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={sharedClasses}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
}
