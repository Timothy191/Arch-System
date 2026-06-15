"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "../lib/utils";
import { useFocusMode } from "../lib/useFocusMode";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import {
  // Departments
  Pickaxe,
  TrendingUp,
  ScanFace,
  Wrench,
  TowerControl,
  HardHat,
  GraduationCap,
  Orbit,
  // Tools
  CheckSquare,
  FileText,
  CalendarDays,
  Calculator,
  StickyNote,
  // Automation
  Workflow,
  Bot,
  // General
  ExternalLink,
  User,
  Shield,
  Search,
  // Menu: View
  RotateCcw,
  Maximize2,
  // Menu: Help
  BookOpen,
  ScrollText,
  MailOpen,
  Info,
  // Menu: Operations dropdown icons (same as dept)
  ChevronRight,
} from "lucide-react";

interface MacMenuBarProps {
  menuItems?: readonly string[];
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

const NAVIGATION_ITEMS: readonly string[] = [];

const DEPARTMENTS_LIST = [
  {
    name: "drilling",
    displayName: "Drilling Operations",
    icon: Pickaxe,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50 hover:bg-blue-100",
    description: "Rig operations & depth telemetry",
  },
  {
    name: "production",
    displayName: "Production Tracking",
    icon: TrendingUp,
    iconColor: "text-accent-green",
    bgColor: "bg-emerald-50 hover:bg-emerald-100",
    description: "Yield & tonnage monitoring",
  },
  {
    name: "access-control",
    displayName: "Access Control",
    icon: ScanFace,
    iconColor: "text-sky-600",
    bgColor: "bg-sky-50 hover:bg-sky-100",
    description: "Personnel badging & visitor logs",
  },
  {
    name: "engineering",
    displayName: "Engineering",
    icon: Wrench,
    iconColor: "text-violet-600",
    bgColor: "bg-violet-50 hover:bg-violet-100",
    description: "CAD, equipment specs & breakdowns",
  },
  {
    name: "control-room",
    displayName: "SCADA Control Room",
    icon: TowerControl,
    iconColor: "text-red-600",
    bgColor: "bg-red-50 hover:bg-red-100",
    description: "Real-time operations monitor",
  },
  {
    name: "safety",
    displayName: "Safety Compliance",
    icon: HardHat,
    iconColor: "text-amber-600",
    bgColor: "bg-amber-50 hover:bg-amber-100",
    description: "Incident reporting & inspections",
  },
  {
    name: "training",
    displayName: "Training & LMS",
    icon: GraduationCap,
    iconColor: "text-cyan-600",
    bgColor: "bg-cyan-50 hover:bg-cyan-100",
    description: "LMS, certificates & site rules",
  },
  {
    name: "satellite-monitoring",
    displayName: "Satellite Monitoring",
    icon: Orbit,
    iconColor: "text-indigo-600",
    bgColor: "bg-indigo-50 hover:bg-indigo-100",
    description: "SAR, High-Res & Hyperspectral",
  },
] as const;

const PRODUCTIVITY_LIST = [
  {
    name: "tasks",
    displayName: "Tasks",
    icon: CheckSquare,
    colorClass: "text-accent-green",
  },
  {
    name: "documents",
    displayName: "Documents",
    icon: FileText,
    colorClass: "text-blue-500",
  },
  {
    name: "schedule",
    displayName: "Schedule",
    icon: CalendarDays,
    colorClass: "text-rose-500",
  },
  {
    name: "calculations",
    displayName: "Calculations",
    icon: Calculator,
    colorClass: "text-violet-500",
  },
  {
    name: "notes",
    displayName: "Notes",
    icon: StickyNote,
    colorClass: "text-amber-500",
  },
] as const;

const EXTERNAL_LIST = [
  {
    name: "n8n",
    displayName: "n8n Workflows",
    icon: Workflow,
    url: "http://localhost:5678",
    colorClass: "text-[#ea4b2a]",
  },
  {
    name: "flowise",
    displayName: "Flowise AI",
    icon: Bot,
    url: "http://localhost:3001",
    colorClass: "text-[#3ecf8e]",
  },
] as const;

const NAV_BTN =
  "px-2.5 h-6 flex items-center rounded text-[13px] font-medium text-[var(--text-heading)] hover:bg-black/10 data-[state=open]:bg-black/10 transition-colors select-none outline-none cursor-default";

const DROPDOWN_CONTENT =
  "bg-white/95 backdrop-blur-2xl shadow-window border border-black/[0.08] rounded-lg py-1";

export function MacMenuBar({
  menuItems = NAVIGATION_ITEMS,
  centerSlot,
  rightSlot,
  className,
}: MacMenuBarProps) {
  const isFocusMode = useFocusMode();
  // Navigation text labels intentionally removed; only logo + search + tray remain
  const [searchQuery, setSearchQuery] = React.useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSearchQuery("");
  }

  return (
    <div
      className={cn(
        "fixed top-2 left-3 right-3 z-navigation h-9 flex items-center justify-between px-4",
        "liquid-glass-light rounded-full shadow-window",
        className,
      )}
    >
      {/* Left: System Menu Trigger + Navigation items */}
      <nav
        className="flex items-center gap-0.5 shrink-0"
        aria-label="Main Navigation"
      >
        {/* ── System Logo Dropdown ── */}
        <DropdownMenu>
          <div className="flex items-center gap-2">
            <DropdownMenuTrigger asChild>
              <button
                aria-label="System Menu"
                aria-haspopup="true"
                className="relative w-11 h-11 -ml-1 rounded-full bg-white border border-black/10 shadow-window flex items-center justify-center hover:bg-gray-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] transition-all duration-150 ease-in-out cursor-default"
              >
                <img
                  src={isFocusMode ? "/logo-focused.jpeg" : "/logo.png"}
                  alt="Arch Logo"
                  className="w-6 h-6 object-contain"
                />
              </button>
            </DropdownMenuTrigger>

            {/* Company branding added globally — keep website logo intact */}
            <img
              src="/company-branding.jpeg"
              alt="Company Logo"
              className="hidden md:block h-7 w-auto object-contain opacity-90"
            />
          </div>
          <DropdownMenuContent
            align="start"
            sideOffset={5}
            className={cn(
              "w-[560px] p-0 flex flex-col md:flex-row overflow-hidden",
              "bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-window rounded-xl",
            )}
          >
            {/* ── Left Column: Departments ── */}
            <div className="flex-1 p-3.5 space-y-2.5">
              <p className="px-2 text-[10.5px] font-medium text-[var(--text-muted)] uppercase tracking-widest">
                System Departments
              </p>
              <div className="grid grid-cols-1 gap-0.5">
                {DEPARTMENTS_LIST.map((dept) => {
                  const Icon = dept.icon;
                  return (
                    <Link
                      key={dept.name}
                      href={`/${dept.name}`}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group"
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center transition-transform group-hover:scale-105",
                          dept.bgColor,
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5", dept.iconColor)} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-medium text-[var(--text-body)] group-hover:text-[var(--text-heading)] truncate leading-tight">
                          {dept.displayName}
                        </span>
                        <span className="text-[10.5px] text-[var(--text-muted)] truncate leading-tight">
                          {dept.description}
                        </span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-60 ml-auto shrink-0 transition-opacity" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ── Right Column: User + Tools + Admin ── */}
            <div className="w-[195px] bg-black/[0.015] border-l border-black/[0.05] flex flex-col shrink-0">
              {/* User Identity */}
              <div className="px-3.5 py-3 flex items-center gap-2.5 border-b border-black/[0.06]">
                <div className="w-8 h-8 rounded-full bg-white border border-black/10 shadow-card flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12.5px] font-medium text-[var(--text-heading)] truncate leading-tight">
                    Arch Operator
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] truncate leading-tight">
                    admin@arch-systems.com
                  </span>
                </div>
              </div>

              {/* Tools */}
              <div className="px-2.5 pt-2.5 pb-1 space-y-0.5">
                <p className="px-2 text-[10.5px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-1">
                  Tools
                </p>
                {PRODUCTIVITY_LIST.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.name}
                      href={`/${DEPARTMENTS_LIST[0]?.name}/tools?tab=${tool.name}`}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group"
                    >
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-colors",
                          tool.colorClass,
                        )}
                      />
                      <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
                        {tool.displayName}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <DropdownMenuSeparator className="bg-black/[0.06] mx-2.5" />

              {/* Automation */}
              <div className="px-2.5 pb-1 space-y-0.5">
                <p className="px-2 text-[10.5px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-1 pt-1">
                  Automation
                </p>
                {EXTERNAL_LIST.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <a
                      key={tool.name}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            tool.colorClass,
                          )}
                        />
                        <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
                          {tool.displayName}
                        </span>
                      </div>
                      <ExternalLink className="w-2.5 h-2.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  );
                })}
              </div>

              {/* Admin Panel */}
              <div className="mt-auto px-2.5 py-2.5 border-t border-black/[0.06]">
                <Link
                  href="/admin"
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-violet-50 active:bg-violet-100 transition-all group"
                >
                  <Shield className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="text-[12.5px] font-medium text-[var(--text-secondary)] group-hover:text-violet-700">
                    Admin Panel
                  </span>
                </Link>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* WhatsApp split window trigger (GitHub trigger moved to Tools menu) */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("open-split-view", {
                detail: { service: "whatsapp" },
              }),
            );
          }}
          className="w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-black/[0.08] shadow-card flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer ml-2.5 shrink-0"
          title="WhatsApp Operations Split"
        >
          <img
            src="/whatsapp-logo.jpeg"
            alt="WhatsApp Logo"
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
        </button>

        {/* ── Menu Bar Items ── */}
        {menuItems.map((item) => {
          if (item === "Operations") {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <button className={NAV_BTN}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={cn("w-60", DROPDOWN_CONTENT)}
                >
                  {DEPARTMENTS_LIST.map((dept) => {
                    const Icon = dept.icon;
                    return (
                      <DropdownMenuItem
                        key={dept.name}
                        asChild
                        className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
                      >
                        <Link
                          href={`/${dept.name}`}
                          className="w-full flex items-center px-2 py-1.5"
                        >
                          <div
                            className={cn(
                              "w-6 h-6 rounded-md flex items-center justify-center mr-2.5 shrink-0",
                              dept.bgColor,
                            )}
                          >
                            <Icon
                              className={cn("w-3.5 h-3.5", dept.iconColor)}
                            />
                          </div>
                          <span className="text-[13px] font-medium text-[var(--text-heading)]">
                            {dept.displayName}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item === "Tools") {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <button className={NAV_BTN}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={cn("w-52", DROPDOWN_CONTENT)}
                >
                  {PRODUCTIVITY_LIST.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <DropdownMenuItem
                        key={tool.name}
                        asChild
                        className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
                      >
                        <Link
                          href={`/${DEPARTMENTS_LIST[0]?.name}/tools?tab=${tool.name}`}
                          className="w-full flex items-center px-2 py-1.5 gap-2.5"
                        >
                          <Icon
                            className={cn("w-4 h-4 shrink-0", tool.colorClass)}
                          />
                          <span className="text-[13px] font-medium text-[var(--text-heading)]">
                            {tool.displayName}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("open-split-view", {
                          detail: { service: "github" },
                        }),
                      );
                    }}
                  >
                    <div className="w-full flex items-center px-2 py-1.5 gap-2.5">
                      <svg
                        className="w-4 h-4 shrink-0 text-black fill-current"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </svg>
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        GitHub Workspace
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-black/[0.06] my-1 mx-1" />
                  {EXTERNAL_LIST.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <DropdownMenuItem
                        key={tool.name}
                        asChild
                        className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
                      >
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-between px-2 py-1.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={cn(
                                "w-4 h-4 shrink-0",
                                tool.colorClass,
                              )}
                            />
                            <span className="text-[13px] font-medium text-[var(--text-heading)]">
                              {tool.displayName}
                            </span>
                          </div>
                          <ExternalLink className="h-3 w-3 opacity-40" />
                        </a>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item === "View") {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <button className={NAV_BTN}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={cn("w-48", DROPDOWN_CONTENT)}
                >
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                    onClick={() => window.location.reload()}
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
                      Reload
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">
                      ⌘R
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement
                          .requestFullscreen()
                          .catch(() => {});
                      } else if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
                      Toggle Fullscreen
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">
                      ⌃⌘F
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item === "Help") {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <button className={NAV_BTN}>{item}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={cn("w-52", DROPDOWN_CONTENT)}
                >
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
                  >
                    <a
                      href="https://docs.arch.os"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2.5 px-2 py-1.5"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        Documentation
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
                  >
                    <a
                      href="https://wiki.arch.os"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2.5 px-2 py-1.5"
                    >
                      <ScrollText className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        Wiki
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-black/[0.06] my-1 mx-1" />
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
                  >
                    <a
                      href="mailto:support@arch.os"
                      className="w-full flex items-center gap-2.5 px-2 py-1.5"
                    >
                      <MailOpen className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        Contact Support
                      </span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-black/[0.06] my-1 mx-1" />
                  <DropdownMenuItem className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5">
                    <Info className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
                      About Arch Systems
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <button key={item} className={NAV_BTN}>
              {item}
            </button>
          );
        })}
      </nav>

      {/* Center: Pill-shaped search or custom slot */}
      <div className="hidden sm:flex flex-1 items-center justify-center mx-4">
        {centerSlot !== undefined ? (
          centerSlot
        ) : (
          <form onSubmit={handleSearch} className="w-full flex justify-center">
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-6 pl-7 pr-3 rounded-full bg-black/[0.04] hover:bg-black/[0.07] border border-arch-border-emphasis/75 focus:border-[var(--accent-blue)]/50 focus:bg-black/[0.05] focus:outline-none text-[12px] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] transition-colors"
              />
            </div>
          </form>
        )}
      </div>

      {/* Right: system tray slot */}
      <div className="flex items-center gap-1.5 shrink-0 text-[12px] text-[var(--text-secondary)]">
        {rightSlot}
      </div>
    </div>
  );
}
