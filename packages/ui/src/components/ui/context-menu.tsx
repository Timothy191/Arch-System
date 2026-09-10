"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  openMenu: (pos: { x: number; y: number }) => void;
  closeMenu: () => void;
}

const ContextMenuContext = React.createContext<ContextMenuState | null>(null);

function useContextMenu() {
  const context = React.useContext(ContextMenuContext);
  if (!context) {
    throw new Error("ContextMenu components must be used within a ContextMenu");
  }
  return context;
}

export interface ContextMenuProps {
  children: React.ReactNode;
}

export function ContextMenu({ children }: ContextMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  const openMenu = React.useCallback((pos: { x: number; y: number }) => {
    setPosition(pos);
    setIsOpen(true);
  }, []);

  const closeMenu = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  // Global click and Escape listeners to close
  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Allow click events inside context menu to fire first
      const target = e.target as HTMLElement;
      if (!target.closest('[data-context-menu-content="true"]')) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeMenu]);

  return (
    <ContextMenuContext.Provider value={{ isOpen, position, openMenu, closeMenu }}>
      <div className="relative inline-block w-full">{children}</div>
    </ContextMenuContext.Provider>
  );
}

export interface ContextMenuTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ContextMenuTrigger({ children, className, ...props }: ContextMenuTriggerProps) {
  const { openMenu } = useContextMenu();
  const longPressTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = React.useRef<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu({ x: e.clientX, y: e.clientY });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openMenu({ x: rect.left + 20, y: rect.top + 20 });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimeout.current = setTimeout(() => {
      if (touchStartPos.current) {
        openMenu(touchStartPos.current);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn("outline-none select-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ContextMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ContextMenuContent({ children, className, ...props }: ContextMenuContentProps) {
  const { isOpen, position } = useContextMenu();
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = React.useState(position);

  React.useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let x = position.x;
    let y = position.y;

    // Viewport overflow bounds flipping
    if (x + rect.width > window.innerWidth - padding) {
      x = Math.max(padding, x - rect.width);
    }
    if (y + rect.height > window.innerHeight - padding) {
      y = Math.max(padding, y - rect.height);
    }

    setAdjustedPos({ x, y });
  }, [isOpen, position]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      data-context-menu-content="true"
      style={{
        position: "fixed",
        left: adjustedPos.x,
        top: adjustedPos.y,
      }}
      className={cn(
        "z-50 min-w-[180px] overflow-hidden rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 text-neutral-900 dark:text-neutral-100 animate-in fade-in-0 zoom-in-95 duration-100",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ContextMenuItemProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onClick" | "prefix"> {
  value?: string;
  onClick?: (value?: string) => void;
  href?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}

export function ContextMenuItem({
  value,
  onClick,
  href,
  prefix,
  suffix,
  disabled = false,
  destructive = false,
  children,
  className,
  ...props
}: ContextMenuItemProps) {
  const { closeMenu } = useContextMenu();

  const handleClick = (_e: React.MouseEvent) => {
    if (disabled) return;
    onClick?.(value);
    closeMenu();
  };

  const content = (
    <>
      {prefix && <span className="mr-2 flex shrink-0 items-center text-neutral-500">{prefix}</span>}
      <span className="flex-1 truncate">{children}</span>
      {suffix && (
        <span className="ml-2 flex shrink-0 items-center text-xs text-neutral-400">{suffix}</span>
      )}
    </>
  );

  const sharedClasses = cn(
    "relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-xs outline-none transition-colors",
    destructive
      ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100",
    disabled && "pointer-events-none opacity-40 cursor-not-allowed",
    className,
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
    <div
      role="menuitem"
      aria-disabled={disabled}
      onClick={handleClick}
      className={sharedClasses}
      {...props}
    >
      {content}
    </div>
  );
}

export function ContextMenuDivider({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("my-1 h-px bg-neutral-200 dark:bg-neutral-800", className)}
      {...props}
    />
  );
}
