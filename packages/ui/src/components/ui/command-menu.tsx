"use client";

import { Search } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

interface ItemRegistration {
  id: string;
  text: string;
  callback?: () => void;
  disabled?: boolean;
}

interface CommandMenuContextType {
  search: string;
  setSearch: (s: string) => void;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  items: ItemRegistration[];
  registerItem: (item: ItemRegistration) => void;
  unregisterItem: (id: string) => void;
  close: () => void;
}

const CommandMenuContext = React.createContext<CommandMenuContextType | null>(null);

function useCommandMenu() {
  const context = React.useContext(CommandMenuContext);
  if (!context) {
    throw new Error("CommandMenu components must be used within a CommandMenu");
  }
  return context;
}

export interface CommandMenuProps {
  open: boolean;
  setOpen?: (open: boolean) => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function CommandMenu({
  open,
  setOpen,
  onOpenChange,
  children,
  className,
  "aria-label": ariaLabel = "Command Menu",
}: CommandMenuProps) {
  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [items, setItems] = React.useState<ItemRegistration[]>([]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen?.(nextOpen);
      onOpenChange?.(nextOpen);
      if (!nextOpen) {
        setSearch("");
        setActiveIndex(0);
      }
    },
    [setOpen, onOpenChange],
  );

  const close = React.useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const registerItem = React.useCallback((item: ItemRegistration) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const existing = prev[idx];
        if (
          existing &&
          existing.text === item.text &&
          existing.disabled === item.disabled &&
          existing.callback === item.callback
        ) {
          return prev;
        }
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const unregisterItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Global ⌘K / Ctrl+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleOpenChange, close]);

  if (!open) return null;

  return (
    <CommandMenuContext.Provider
      value={{
        search,
        setSearch,
        activeIndex,
        setActiveIndex,
        items,
        registerItem,
        unregisterItem,
        close,
      }}
    >
      <div
        className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh] bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div
          className={cn(
            "w-full max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 transition-all text-neutral-900 dark:text-neutral-100",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </CommandMenuContext.Provider>
  );
}

export interface CommandMenuInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CommandMenuInput = React.forwardRef<HTMLInputElement, CommandMenuInputProps>(
  ({ placeholder = "What do you need?", className, value, onChange, ...props }, ref) => {
    const { search, setSearch, activeIndex, setActiveIndex, items, close } = useCommandMenu();
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current!);

    React.useEffect(() => {
      inputRef.current?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setActiveIndex(0);
      onChange?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const activeItems = items.filter(
        (i) =>
          !i.disabled && (search === "" || i.text.toLowerCase().includes(search.toLowerCase())),
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (activeItems.length === 0 ? 0 : (prev + 1) % activeItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          activeItems.length === 0 ? 0 : (prev - 1 + activeItems.length) % activeItems.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeItems[activeIndex]?.callback) {
          activeItems[activeIndex].callback!();
          close();
        }
      }
    };

    return (
      <div className="flex items-center border-b border-neutral-200 px-3 dark:border-neutral-800">
        <Search className="mr-2 h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
        <input
          ref={inputRef}
          type="text"
          value={value !== undefined ? value : search}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-mono font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400 select-none">
          ESC
        </kbd>
      </div>
    );
  },
);

CommandMenuInput.displayName = "CommandMenuInput";

export interface CommandMenuListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  emptyMessage?: string;
}

export function CommandMenuList({
  children,
  className,
  emptyMessage = "No results found.",
  ...props
}: CommandMenuListProps) {
  const { search, items } = useCommandMenu();

  const matchingCount = items.filter(
    (i) => search === "" || i.text.toLowerCase().includes(search.toLowerCase()),
  ).length;

  // Always render children so registered items stay mounted (their effects populate
  // `items`). Unmounting them to show the empty message would remove the items and
  // flip the empty-state condition back, causing an infinite mount/unmount loop.
  const showEmpty = items.length > 0 && matchingCount === 0;

  return (
    <div
      className={cn("max-h-80 overflow-y-auto overflow-x-hidden p-2 space-y-1", className)}
      role="listbox"
      aria-live="polite"
      {...props}
    >
      {children}
      {showEmpty && (
        <div className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

export interface CommandMenuGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: React.ReactNode;
  children: React.ReactNode;
}

export function CommandMenuGroup({
  heading,
  children,
  className,
  ...props
}: CommandMenuGroupProps) {
  const { search } = useCommandMenu();
  const groupRef = React.useRef<HTMLDivElement>(null);
  const [hasVisibleChildren, setHasVisibleChildren] = React.useState(true);

  React.useEffect(() => {
    if (!search) {
      setHasVisibleChildren(true);
      return;
    }
    if (groupRef.current) {
      const items = groupRef.current.querySelectorAll('[data-command-item="true"]');
      setHasVisibleChildren(items.length > 0);
    }
  }, [search]);

  // Keep children mounted even when none are visible: unmounting them would run
  // their unregisterItem cleanup, removing them from the shared `items` array and
  // flipping CommandMenuList's empty-state condition back — an infinite loop.
  // Non-matching CommandMenuItems already return null, so only the heading hides.
  return (
    <div
      ref={groupRef}
      className={cn("overflow-hidden px-1 py-1.5", className)}
      role="group"
      {...props}
    >
      {heading && hasVisibleChildren && (
        <div className="px-2 pb-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 select-none">
          {heading}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export interface CommandMenuItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect" | "prefix"> {
  callback?: () => void;
  onSelect?: () => void;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}

export function CommandMenuItem({
  callback,
  onSelect,
  prefix,
  suffix,
  disabled = false,
  children,
  className,
  ...props
}: CommandMenuItemProps) {
  const id = React.useId();
  const { search, activeIndex, items, registerItem, unregisterItem, close } = useCommandMenu();

  const textContent = React.useMemo(() => {
    if (typeof children === "string") return children;
    return String(children);
  }, [children]);

  const selectRef = React.useRef({ callback, onSelect, close, disabled });
  selectRef.current = { callback, onSelect, close, disabled };

  const handleSelect = React.useCallback(() => {
    if (selectRef.current.disabled) return;
    selectRef.current.callback?.();
    selectRef.current.onSelect?.();
    selectRef.current.close();
  }, []);

  React.useEffect(() => {
    registerItem({
      id,
      text: textContent,
      callback: handleSelect,
      disabled,
    });
    return () => unregisterItem(id);
  }, [id, textContent, handleSelect, disabled, registerItem, unregisterItem]);

  const matches = React.useMemo(() => {
    if (!search) return true;
    return textContent.toLowerCase().includes(search.toLowerCase());
  }, [search, textContent]);

  if (!matches) return null;

  // Check if this item is currently active in the filtered list
  const activeItems = items.filter(
    (i) => !i.disabled && (search === "" || i.text.toLowerCase().includes(search.toLowerCase())),
  );
  const isActive = activeItems[activeIndex]?.id === id;

  return (
    <div
      role="option"
      aria-selected={isActive}
      aria-disabled={disabled}
      data-command-item="true"
      onClick={handleSelect}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-sm outline-none transition-colors",
        isActive
          ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/60",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      {prefix && <div className="mr-2 flex shrink-0 items-center text-neutral-400">{prefix}</div>}
      <div className="flex-1 truncate">{children}</div>
      {suffix && <div className="ml-2 flex shrink-0 items-center text-xs">{suffix}</div>}
    </div>
  );
}

export function CommandMenuDivider({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("my-1.5 h-px bg-neutral-200 dark:bg-neutral-800", className)}
      {...props}
    />
  );
}
