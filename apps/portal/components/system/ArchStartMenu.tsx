"use client";

import { cn } from "@repo/ui/lib/utils";
import {
  Command,
  CreditCard,
  Factory,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  type LucideIcon,
  Monitor,
  Pickaxe,
  Satellite,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { logout } from "@/app/actions";
import { ARCH_LOCK_EVENT } from "./ArchLockOverlay";

export interface ArchStartMenuProps {
  onClose: () => void;
}

interface StartApp {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  pinned?: boolean;
  action?: "command-palette";
}

const START_APPS: StartApp[] = [
  { id: "hub", label: "Hub", href: "/", icon: LayoutDashboard, pinned: true },
  { id: "drilling", label: "Drilling", href: "/drilling", icon: Pickaxe, pinned: true },
  { id: "control", label: "Control Room", href: "/control-room", icon: Monitor, pinned: true },
  { id: "safety", label: "Safety", href: "/safety", icon: Shield, pinned: true },
  { id: "engineering", label: "Engineering", href: "/engineering", icon: Wrench, pinned: true },
  { id: "admin", label: "Admin", href: "/admin", icon: Settings, pinned: true },
  { id: "production", label: "Production", href: "/production", icon: Factory },
  { id: "access", label: "Access Control", href: "/access-control", icon: ShieldCheck },
  { id: "cards", label: "Access Card Actions", href: "/access-card-actions", icon: CreditCard },
  { id: "training", label: "Training", href: "/training", icon: GraduationCap },
  {
    id: "satellite",
    label: "Satellite Monitoring",
    href: "/satellite-monitoring",
    icon: Satellite,
  },
  { id: "docs", label: "API Docs", href: "/docs/api", icon: FileText },
  { id: "privacy", label: "Privacy", href: "/privacy", icon: FileText },
  { id: "palette", label: "Command palette", icon: Command, action: "command-palette" },
];

/**
 * Windows 11–style Start menu panel for the Arch taskbar pill.
 */
export function ArchStartMenu({ onClose }: ArchStartMenuProps) {
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalized) return START_APPS;
    return START_APPS.filter((app) => app.label.toLowerCase().includes(normalized));
  }, [normalized]);

  const pinned = filtered.filter((app) => app.pinned);
  const allApps = filtered
    .filter((app) => !app.pinned)
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));

  const openCommandPalette = useCallback(() => {
    onClose();
    window.dispatchEvent(new CustomEvent("arch-open-command-bar"));
  }, [onClose]);

  const handleAppActivate = useCallback(
    (app: StartApp) => {
      if (app.action === "command-palette") {
        openCommandPalette();
        return;
      }
      onClose();
    },
    [onClose, openCommandPalette]
  );

  const handleLock = useCallback(() => {
    onClose();
    window.dispatchEvent(new CustomEvent(ARCH_LOCK_EVENT));
  }, [onClose]);

  return (
    <div
      data-testid="arch-start-menu"
      className="flex max-h-[min(80vh,34rem)] w-full flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white/90 shadow-window backdrop-blur-2xl"
    >
      <div className="border-b border-black/[0.06] p-3">
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Arch…"
            aria-label="Search Arch"
            className={cn(
              "h-10 w-full rounded-xl border border-black/[0.08] bg-black/[0.03] pl-9 pr-3",
              "text-[13px] text-[var(--text-heading)] placeholder:text-[var(--text-muted)]",
              "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
            )}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {pinned.length > 0 && (
          <section aria-label="Pinned">
            <h2 className="mb-2 px-1 font-display text-[10px] font-normal uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Pinned
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {pinned.map((app) => (
                <StartTile key={app.id} app={app} onActivate={handleAppActivate} />
              ))}
            </div>
          </section>
        )}

        <section aria-label="All apps">
          <h2 className="mb-2 px-1 font-display text-[10px] font-normal uppercase tracking-[0.2em] text-[var(--text-muted)]">
            All apps
          </h2>
          {allApps.length === 0 && pinned.length === 0 ? (
            <p className="px-2 py-4 text-center text-[12px] text-[var(--text-muted)]">
              No matches for “{query}”
            </p>
          ) : (
            <ul className="space-y-0.5">
              {allApps.map((app) => (
                <li key={app.id}>
                  <StartRow app={app} onActivate={handleAppActivate} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] bg-black/[0.02] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.08] text-[12px] font-semibold text-[var(--text-heading)]"
            aria-hidden
          >
            A
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[var(--text-heading)]">Arch User</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">Plantcor Mainframe</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            role="menuitem"
            aria-label="Lock screen"
            title="Lock"
            onClick={handleLock}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              "text-[var(--text-secondary)] hover:bg-black/[0.06] hover:text-[var(--text-heading)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
            )}
          >
            <Lock className="h-4 w-4" aria-hidden />
          </button>
          <form
            action={logout}
            onSubmit={() => {
              onClose();
            }}
          >
            <button
              type="submit"
              role="menuitem"
              aria-label="Sign out"
              title="Sign out"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium",
                "text-[var(--text-secondary)] hover:bg-black/[0.06] hover:text-[var(--text-heading)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
              )}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface StartItemProps {
  app: StartApp;
  onActivate: (_app: StartApp) => void;
}

function StartTile({ app, onActivate }: StartItemProps) {
  const Icon = app.icon;
  const className = cn(
    "flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center",
    "text-[var(--text-heading)] hover:bg-black/[0.06]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
  );

  const body = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.05] border border-black/[0.06]">
        <Icon className="h-5 w-5 text-[var(--text-secondary)]" aria-hidden />
      </span>
      <span className="line-clamp-2 w-full text-[11px] font-medium leading-tight">{app.label}</span>
    </>
  );

  if (app.href) {
    return (
      <Link href={app.href} role="menuitem" className={className} onClick={() => onActivate(app)}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" role="menuitem" className={className} onClick={() => onActivate(app)}>
      {body}
    </button>
  );
}

function StartRow({ app, onActivate }: StartItemProps) {
  const Icon = app.icon;
  const className = cn(
    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
    "text-[var(--text-heading)] hover:bg-black/[0.06]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
  );

  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.05]">
        <Icon className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden />
      </span>
      <span className="truncate text-[13px] font-medium">{app.label}</span>
    </>
  );

  if (app.href) {
    return (
      <Link href={app.href} role="menuitem" className={className} onClick={() => onActivate(app)}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" role="menuitem" className={className} onClick={() => onActivate(app)}>
      {body}
    </button>
  );
}
