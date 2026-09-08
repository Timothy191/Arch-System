"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronDown, X, Check } from "lucide-react";

interface OptionRegistration {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ComboboxContextType {
  value: string | null;
  selectValue: (val: string | null, label?: string) => void;
  query: string;
  setQuery: (q: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  disabled: boolean;
  errored: boolean;
  size: "small" | "medium" | "large";
  clearable: boolean;
  placeholder: string;
  registerOption: (opt: OptionRegistration) => void;
  unregisterOption: (val: string) => void;
  options: OptionRegistration[];
  highlightedIndex: number;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  rootId?: string;
}

const ComboboxContext = React.createContext<ComboboxContextType | null>(null);

function useCombobox() {
  const ctx = React.useContext(ComboboxContext);
  if (!ctx) {
    throw new Error("Combobox components must be used within a Combobox");
  }
  return ctx;
}

export interface ComboboxProps {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  errored?: boolean;
  clearable?: boolean;
  size?: "small" | "medium" | "large";
  width?: number | string;
  "aria-label"?: string;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export function Combobox({
  value: controlledValue,
  defaultValue = null,
  onChange,
  placeholder = "Search...",
  disabled = false,
  errored = false,
  clearable = false,
  size = "medium",
  width,
  "aria-label": ariaLabel,
  id,
  className,
  children,
}: ComboboxProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | null>(defaultValue);
  const [query, setQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [options, setOptions] = React.useState<OptionRegistration[]>([]);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const selectValue = React.useCallback(
    (val: string | null, label?: string) => {
      if (!isControlled) {
        setUncontrolledValue(val);
      }
      onChange?.(val);
      if (label) {
        setQuery(label);
      } else if (!val) {
        setQuery("");
      }
      setIsOpen(false);
    },
    [isControlled, onChange],
  );

  const registerOption = React.useCallback((opt: OptionRegistration) => {
    setOptions((prev) => {
      const idx = prev.findIndex((o) => o.value === opt.value);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = opt;
        return next;
      }
      return [...prev, opt];
    });
  }, []);

  const unregisterOption = React.useCallback((val: string) => {
    setOptions((prev) => prev.filter((o) => o.value !== val));
  }, []);

  // Update query to match option label if activeValue changes
  React.useEffect(() => {
    if (activeValue) {
      const match = options.find((o) => o.value === activeValue);
      if (match && query === "") {
        setQuery(match.label);
      }
    }
  }, [activeValue, options, query]);

  // Click outside to close
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const style: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
  };

  return (
    <ComboboxContext.Provider
      value={{
        value: activeValue,
        selectValue,
        query,
        setQuery,
        isOpen,
        setIsOpen,
        disabled,
        errored,
        size,
        clearable,
        placeholder,
        registerOption,
        unregisterOption,
        options,
        highlightedIndex,
        setHighlightedIndex,
        rootId: id,
      }}
    >
      <div
        ref={containerRef}
        id={id}
        style={style}
        aria-label={ariaLabel}
        className={cn("relative inline-block w-full text-left font-sans", className)}
      >
        {children}
      </div>
    </ComboboxContext.Provider>
  );
}

export interface ComboboxInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ComboboxInput = React.forwardRef<HTMLInputElement, ComboboxInputProps>(
  ({ className, placeholder: customPlaceholder, onChange, ...props }, ref) => {
    const {
      value,
      selectValue,
      query,
      setQuery,
      isOpen,
      setIsOpen,
      disabled,
      errored,
      size,
      clearable,
      placeholder,
      options,
      highlightedIndex,
      setHighlightedIndex,
    } = useCombobox();

    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current!);

    const filteredOptions = options.filter(
      (o) => !o.disabled && (query === "" || o.label.toLowerCase().includes(query.toLowerCase())),
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          filteredOptions.length === 0 ? 0 : (prev + 1) % filteredOptions.length,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          filteredOptions.length === 0
            ? 0
            : (prev - 1 + filteredOptions.length) % filteredOptions.length,
        );
      } else if (e.key === "Enter") {
        if (isOpen && filteredOptions[highlightedIndex]) {
          e.preventDefault();
          const chosen = filteredOptions[highlightedIndex];
          selectValue(chosen.value, chosen.label);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      selectValue(null);
      setQuery("");
      inputRef.current?.focus();
    };

    const heightClass =
      size === "small"
        ? "h-8 text-xs px-2.5"
        : size === "large"
          ? "h-11 text-base px-4"
          : "h-9 text-sm px-3";

    return (
      <div className="relative flex items-center w-full">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={query}
          placeholder={customPlaceholder || placeholder}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
            onChange?.(e);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full rounded-md border bg-white dark:bg-neutral-900 pr-8 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors outline-none",
            heightClass,
            errored
              ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-neutral-900 dark:focus:border-neutral-100",
            disabled && "cursor-not-allowed opacity-50 bg-neutral-100 dark:bg-neutral-800/50",
            className,
          )}
          {...props}
        />
        <div className="absolute right-2.5 flex items-center gap-1 text-neutral-400 dark:text-neutral-500">
          {clearable && (value !== null || query !== "") && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-150 pointer-events-none",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </div>
    );
  },
);

ComboboxInput.displayName = "ComboboxInput";

export interface ComboboxListProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  maxWidth?: number | string;
  emptyMessage?: string;
}

export function ComboboxList({
  children,
  maxWidth,
  emptyMessage = "No results found.",
  className,
  style,
  ...props
}: ComboboxListProps) {
  const { isOpen, query, options } = useCombobox();

  if (!isOpen) return null;

  const filtered = options.filter(
    (o) => query === "" || o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const customStyle: React.CSSProperties = {
    ...style,
    ...(maxWidth !== undefined
      ? { maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth }
      : {}),
  };

  return (
    <div
      role="listbox"
      style={customStyle}
      className={cn(
        "absolute left-0 top-[calc(100%+4px)] z-50 min-w-full max-h-60 overflow-y-auto overflow-x-hidden rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 animate-in fade-in-0 duration-100",
        className,
      )}
      {...props}
    >
      {options.length > 0 && filtered.length === 0 ? (
        <div className="py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export interface ComboboxOptionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "prefix"> {
  value: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  disabled?: boolean;
  ignoreDefaultHeight?: boolean;
  children: React.ReactNode;
}

export function ComboboxOption({
  value,
  prefix,
  suffix,
  disabled = false,
  ignoreDefaultHeight = false,
  children,
  className,
  ...props
}: ComboboxOptionProps) {
  const {
    value: selectedValue,
    selectValue,
    query,
    registerOption,
    unregisterOption,
    highlightedIndex,
    options,
  } = useCombobox();

  const label = React.useMemo(() => {
    if (typeof children === "string") return children;
    return value;
  }, [children, value]);

  React.useEffect(() => {
    registerOption({ value, label, disabled });
    return () => unregisterOption(value);
  }, [value, label, disabled, registerOption, unregisterOption]);

  const matches = React.useMemo(() => {
    if (!query) return true;
    return label.toLowerCase().includes(query.toLowerCase());
  }, [query, label]);

  if (!matches) return null;

  const isSelected = selectedValue === value;
  const filtered = options.filter(
    (o) => !o.disabled && (query === "" || o.label.toLowerCase().includes(query.toLowerCase())),
  );
  const isHighlighted = filtered[highlightedIndex]?.value === value;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) {
          selectValue(value, label);
        }
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center justify-between rounded px-2 text-sm transition-colors",
        !ignoreDefaultHeight && "h-8",
        isHighlighted || isSelected
          ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium"
          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60",
        disabled && "pointer-events-none opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {prefix && <span className="shrink-0 flex items-center text-neutral-500">{prefix}</span>}
        <span className={cn("truncate", ignoreDefaultHeight && "whitespace-normal")}>
          {children}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {suffix && <span className="text-neutral-500 text-xs">{suffix}</span>}
        {isSelected && (
          <Check className="h-3.5 w-3.5 text-neutral-900 dark:text-neutral-100 stroke-[2.5]" />
        )}
      </div>
    </div>
  );
}
