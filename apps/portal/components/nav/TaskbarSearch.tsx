"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, UserRound, Clock3, Loader2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { ArchSearchResponse, ArchSearchResult } from "~/lib/search/types";

const CATEGORY_META = {
  department: { label: "Departments", icon: Building2 },
  employee: { label: "Employees", icon: UserRound },
  shift: { label: "Shifts", icon: Clock3 },
} as const;

function groupResults(results: ArchSearchResult[]) {
  return (Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((category) => ({
    category,
    ...CATEGORY_META[category],
    items: results.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
}

export function TaskbarSearch() {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArchSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const flatResults = results;

  const navigateTo = useCallback(
    (item: ArchSearchResult) => {
      setOpen(false);
      setQuery("");
      setResults([]);
      router.push(item.href);
    },
    [router],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      setOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    setOpen(true);

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
            cache: "no-store",
            signal: controller.signal,
          });

          if (!res.ok) {
            throw new Error(res.status === 401 ? "Sign in to search Arch." : "Search unavailable.");
          }

          const data = (await res.json()) as ArchSearchResponse;
          if (!controller.signal.aborted) {
            setResults(data.results ?? []);
            setSelectedIndex(0);
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          setResults([]);
          setError(err instanceof Error ? err.message : "Search unavailable.");
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(flatResults.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const item = flatResults[selectedIndex];
      if (item) {
        navigateTo(item);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const grouped = groupResults(results);
  let runningIndex = -1;

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full min-w-0 max-w-[11.5rem] sm:max-w-[13rem] md:max-w-[15rem] lg:max-w-[16.5rem]"
    >
      <form
        className="brand-taskbar-search-wrap w-full"
        onSubmit={(event) => {
          event.preventDefault();
          const item = flatResults[selectedIndex];
          if (item) navigateTo(item);
        }}
      >
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-[var(--brand-silver-muted)] pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search shifts, fleet, staff…"
          aria-label="Search Arch"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          className="w-full h-7 pl-7 pr-7 rounded-full brand-taskbar-search text-[11px] leading-none text-[var(--text-heading)] placeholder:text-[var(--brand-silver-muted)]"
        />
        {loading && (
          <Loader2
            className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 animate-spin text-[var(--brand-silver-muted)]"
            aria-hidden="true"
          />
        )}
      </form>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+6px)] z-[130]",
            "rounded-xl border border-[var(--brand-gold-border)] bg-white/97 backdrop-blur-xl shadow-window",
            "max-h-72 overflow-y-auto p-1.5",
          )}
        >
          {error && (
            <p className="px-2.5 py-2 text-[11px] text-[var(--accent-red)]">{error}</p>
          )}

          {!error && !loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
              No matches for &ldquo;{query.trim()}&rdquo;
            </p>
          )}

          {grouped.map((group) => (
            <div key={group.category} className="py-1">
              <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">
                {group.label}
              </p>
              {group.items.map((item) => {
                runningIndex += 1;
                const itemIndex = runningIndex;
                const Icon = group.icon;
                const isSelected = itemIndex === selectedIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    onClick={() => navigateTo(item)}
                    className={cn(
                      "w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      isSelected ? "bg-black/[0.05]" : "hover:bg-black/[0.04]",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--brand-gold)]" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-[var(--text-heading)] truncate">
                        {item.title}
                      </span>
                      <span className="block text-[10px] text-[var(--text-muted)] truncate">
                        {item.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
