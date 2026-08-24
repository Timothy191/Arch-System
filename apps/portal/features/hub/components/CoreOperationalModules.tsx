"use client";

import { useState, useMemo, useEffect } from "react";
import type { Department } from "@repo/departments/data-access";
import { DepartmentCard } from "@/features/hub";
import { Boxes, Search, Star } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface CoreOperationalModulesProps {
  departments: Department[];
}

type FilterCategory = "all" | "pinned" | "active" | "critical";

// AGENT-TRACE: Refactored Core Operational Modules component for Hub page with interactive search, category/status filtering, and pinned priority ordering.
export function CoreOperationalModules({ departments }: CoreOperationalModulesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [pinnedNames, setPinnedNames] = useState<Set<string>>(new Set());

  // Load pinned departments from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pinned = new Set<string>();
    departments.forEach((dept) => {
      if (localStorage.getItem(`pinned_dept_${dept.name}`) === "true") {
        pinned.add(dept.name);
      }
    });
    setPinnedNames(pinned);
  }, [departments]);

  // Filter and sort departments
  const filteredDepartments = useMemo(() => {
    return departments
      .filter((dept) => {
        // Search query filter
        const matchesSearch =
          searchQuery.trim() === "" ||
          dept.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dept.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dept.name.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // Category filter
        if (activeFilter === "pinned") {
          return pinnedNames.has(dept.name);
        }
        if (activeFilter === "active") {
          return dept.status === "active";
        }
        if (activeFilter === "critical") {
          return dept.status === "alert" || dept.status === "maintenance";
        }

        return true;
      })
      .sort((a, b) => {
        // Pinned modules float to the top
        const aPinned = pinnedNames.has(a.name);
        const bPinned = pinnedNames.has(b.name);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0;
      });
  }, [departments, searchQuery, activeFilter, pinnedNames]);

  const pinnedCount = pinnedNames.size;

  // Keyboard shortcut: Press '/' or 'Cmd+K' to focus module search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        const input = document.getElementById("hub-module-search") as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section
      className="space-y-4 animate-fade-up group/row relative rounded-xl bg-white/70 backdrop-blur-xl border border-black/[0.08] shadow-card p-4 sm:p-6"
      style={{ animationDelay: "0.2s", animationFillMode: "both" }}
    >
      {/* Section Header with Live Filtering */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-arch-border-subtle">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-arch-text-primary group-hover/row:text-arch-accent-blue transition-colors duration-300 flex items-center gap-2.5">
            <span className="p-1 rounded-md bg-arch-accent-blue/10 text-arch-accent-blue">
              <Boxes className="w-4 h-4" />
            </span>
            Core Operational Modules
            <span className="ml-1 px-2 py-0.5 rounded-full bg-arch-surface-secondary border border-arch-border-subtle text-arch-text-secondary text-[11px] font-mono">
              {filteredDepartments.length} / {departments.length}
            </span>
          </h2>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Search Input */}
          <div className="relative flex-1 sm:w-52 min-w-[160px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-arch-text-tertiary pointer-events-none" />
            <input
              id="hub-module-search"
              type="text"
              aria-label="Search operational modules"
              aria-describedby="hub-module-search-hint"
              placeholder="Search modules... (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-7 text-xs rounded-lg bg-arch-surface-secondary/80 border border-arch-border-subtle focus:border-arch-accent-blue/50 focus:outline-none focus:ring-1 focus:ring-arch-accent-blue/50 text-arch-text-primary placeholder:text-arch-text-tertiary transition-all"
            />
            <span id="hub-module-search-hint" className="sr-only">
              Press slash or Command K to focus the module search
            </span>
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-arch-text-tertiary hover:text-arch-text-primary"
              >
                ✕
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-arch-text-tertiary font-mono bg-arch-surface-tertiary px-1 rounded border border-arch-border-subtle pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Filter Pills */}
          <div
            className="flex items-center gap-1 bg-arch-surface-secondary/80 p-1 rounded-lg border border-arch-border-subtle text-xs font-medium"
            role="group"
            aria-label="Filter modules by category"
          >
            <button
              type="button"
              aria-pressed={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all text-xs",
                activeFilter === "all"
                  ? "bg-white text-arch-text-primary shadow-card font-semibold"
                  : "text-arch-text-tertiary hover:text-arch-text-secondary",
              )}
            >
              All
            </button>
            {pinnedCount > 0 && (
              <button
                type="button"
                aria-pressed={activeFilter === "pinned"}
                onClick={() => setActiveFilter("pinned")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all text-xs flex items-center gap-1",
                  activeFilter === "pinned"
                    ? "bg-white text-arch-accent-blue shadow-card font-semibold"
                    : "text-arch-text-tertiary hover:text-arch-text-secondary",
                )}
              >
                <Star className="w-3 h-3 fill-arch-accent-blue/20" />
                Pinned ({pinnedCount})
              </button>
            )}
            <button
              type="button"
              aria-pressed={activeFilter === "active"}
              onClick={() => setActiveFilter("active")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all text-xs",
                activeFilter === "active"
                  ? "bg-white text-accent-green shadow-card font-semibold"
                  : "text-arch-text-tertiary hover:text-arch-text-secondary",
              )}
            >
              Active
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === "critical"}
              onClick={() => setActiveFilter("critical")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all text-xs",
                activeFilter === "critical"
                  ? "bg-white text-accent-amber shadow-card font-semibold"
                  : "text-arch-text-tertiary hover:text-arch-text-secondary",
              )}
            >
              Alerts
            </button>
          </div>
        </div>
      </div>

      {/* Grid Display */}
      {filteredDepartments.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl bg-arch-surface-secondary/40 border border-arch-border-subtle space-y-3">
          <p className="text-sm font-medium text-arch-text-secondary">
            No operational modules matched your search filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveFilter("all");
            }}
            className="text-xs text-arch-accent-blue hover:underline font-medium"
          >
            Clear search and category filters
          </button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5 auto-rows-fr"
          aria-label="Department modules"
          role="list"
        >
          {filteredDepartments.map((dept, i) => (
            <div key={dept.name} role="listitem">
              <DepartmentCard department={dept} index={i} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
