"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { useFocusMode } from "../lib/useFocusMode";
import { Logo } from "./Logo";
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
  CreditCard,
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
  // General
  ExternalLink,
  User,
  Shield,
  // Menu: View
  RotateCcw,
  Maximize2,
  AppWindow,
  // Menu: Help
  BookOpen,
  ScrollText,
  MailOpen,
  Info,
  CircleHelp,
  // Menu: Operations
  LayoutGrid,
  // Menu: Operations dropdown icons (same as dept)
  ChevronRight,
} from "lucide-react";

export interface TaskbarProps {
  menuItems?: readonly string[];
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

const NAVIGATION_ITEMS = ["Operations", "View", "Help"] as const;

const NAV_MENU_ICONS: Record<
  string,
  { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }
> = {
  Operations: { icon: LayoutGrid, label: "Operations" },
  Tools: { icon: Wrench, label: "Tools" },
  View: { icon: AppWindow, label: "View" },
  Help: { icon: CircleHelp, label: "Help" },
};

const NAV_BTN_ICON =
  "w-8 h-8 flex items-center justify-center rounded-[4px] text-[var(--text-heading)] opacity-90 hover:bg-black/[0.07] hover:opacity-100 data-[state=open]:bg-black/[0.07] transition-colors select-none outline-none cursor-default";

function NavMenuTrigger({ item }: { item: string }) {
  const meta = NAV_MENU_ICONS[item];
  if (!meta) {
    return (
      <button type="button" className={NAV_BTN_ICON}>
        {item}
      </button>
    );
  }
  const Icon = meta.icon;
  return (
    <button type="button" className={NAV_BTN_ICON} aria-label={meta.label} title={meta.label}>
      <Icon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

const DROPDOWN_CONTENT =
  "bg-white/95 backdrop-blur-2xl shadow-window border border-black/[0.08] rounded-lg py-1";

const DEPARTMENTS_LIST = [
  {
    name: "drilling",
    displayName: "Drilling Operations",
    icon: Pickaxe,
    iconColor: "text-dept-drilling",
    bgColor: "bg-dept-drilling/10 hover:bg-dept-drilling/15",
    description: "Rig operations & depth telemetry",
  },
  {
    name: "production",
    displayName: "Production Tracking",
    icon: TrendingUp,
    iconColor: "text-dept-production",
    bgColor: "bg-dept-production/10 hover:bg-dept-production/15",
    description: "Yield & tonnage monitoring",
  },
  {
    name: "access-control",
    displayName: "Access Control",
    icon: ScanFace,
    iconColor: "text-dept-access-control",
    bgColor: "bg-dept-access-control/10 hover:bg-dept-access-control/15",
    description: "Personnel badging & visitor logs",
  },
  {
    name: "access-card-actions",
    displayName: "Access Card Actions",
    icon: CreditCard,
    iconColor: "text-dept-access-card-actions",
    bgColor: "bg-dept-access-card-actions/10 hover:bg-dept-access-card-actions/15",
    description: "Badge printing & QR generation",
  },
  {
    name: "engineering",
    displayName: "Engineering",
    icon: Wrench,
    iconColor: "text-dept-engineering",
    bgColor: "bg-dept-engineering/10 hover:bg-dept-engineering/15",
    description: "CAD, equipment specs & breakdowns",
  },
  {
    name: "control-room",
    displayName: "SCADA Control Room",
    icon: TowerControl,
    iconColor: "text-dept-control-room",
    bgColor: "bg-dept-control-room/10 hover:bg-dept-control-room/15",
    description: "Real-time operations monitor",
  },
  {
    name: "safety",
    displayName: "Safety Compliance",
    icon: HardHat,
    iconColor: "text-dept-safety",
    bgColor: "bg-dept-safety/10 hover:bg-dept-safety/15",
    description: "Incident reporting & inspections",
  },
  {
    name: "training",
    displayName: "Training & LMS",
    icon: GraduationCap,
    iconColor: "text-dept-training",
    bgColor: "bg-dept-training/10 hover:bg-dept-training/15",
    description: "LMS, certificates & site rules",
  },
  {
    name: "satellite-monitoring",
    displayName: "Satellite Monitoring",
    icon: Orbit,
    iconColor: "text-dept-satellite",
    bgColor: "bg-dept-satellite/10 hover:bg-dept-satellite/15",
    description: "SAR, High-Res & Hyperspectral",
  },
] as const;

const PRODUCTIVITY_LIST = [
  {
    name: "tasks",
    displayName: "Tasks",
    icon: CheckSquare,
    colorClass: "text-dept-production",
  },
  {
    name: "documents",
    displayName: "Documents",
    icon: FileText,
    colorClass: "text-dept-drilling",
  },
  {
    name: "schedule",
    displayName: "Schedule",
    icon: CalendarDays,
    colorClass: "text-dept-control-room",
  },
  {
    name: "calculations",
    displayName: "Calculations",
    icon: Calculator,
    colorClass: "text-dept-engineering",
  },
  {
    name: "notes",
    displayName: "Notes",
    icon: StickyNote,
    colorClass: "text-dept-safety",
  },
] as const;

export function Taskbar({
  menuItems = NAVIGATION_ITEMS,
  centerSlot,
  rightSlot,
  className,
}: TaskbarProps) {
  const isFocusMode = useFocusMode();

  return (
    <motion.div
      role="toolbar"
      aria-label="Taskbar"
      data-component="taskbar"
      initial={false}
      animate={{
        opacity: isFocusMode ? 0.92 : 1,
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "fixed inset-x-0 top-0 z-navigation box-border w-full max-w-[100vw] h-10",
        "flex items-center justify-between gap-2",
        "pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:px-4 md:px-6 lg:px-8",
        "layer-taskbar-brushed rounded-none shadow-window relative overflow-hidden",
        className,
      )}
    >
      <span className="brand-gold-border-shine" aria-hidden="true" />
      {/* Left: System Menu Trigger + Navigation items */}
      <nav className="flex items-center gap-0.5 shrink-0" aria-label="Main Navigation">
        {/* ── System Logo Dropdown ── */}
        <DropdownMenu>
          <div className="flex items-center gap-2">
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Application launcher"
                aria-haspopup="true"
                className="brand-chrome-orb relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold-edge)] transition-colors duration-150 ease-in-out cursor-default"
              >
                <Logo className="h-6 w-6 text-[var(--brand-silver)]" />
              </button>
            </DropdownMenuTrigger>
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
                        className={cn("w-3.5 h-3.5 shrink-0 transition-colors", tool.colorClass)}
                      />
                      <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
                        {tool.displayName}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <DropdownMenuSeparator className="bg-black/[0.06] mx-2.5" />

              {/* Split View */}
              <div className="px-2.5 pb-1 space-y-0.5">
                <p className="px-2 text-[10.5px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-1 pt-1">
                  Split View
                </p>
                <DropdownMenuItem asChild>
                  <button
                    onClick={() => {
                      window.open(
                        "https://web.whatsapp.com",
                        "whatsapp-web",
                        `width=400,height=${window.innerHeight},left=${window.screen.width - 400},top=0`,
                      );
                    }}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-black/[0.04] active:bg-black/[0.08] transition-all group text-left focus:outline-none cursor-default"
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0 text-dept-engineering"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="12" y1="3" x2="12" y2="21" />
                    </svg>
                    <span className="text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] font-medium">
                      New Split Tab
                    </span>
                  </button>
                </DropdownMenuItem>
              </div>

              {/* Admin Panel */}
              <div className="mt-auto px-2.5 py-2.5 border-t border-black/[0.06]">
                <Link
                  href="/admin"
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-dept-admin/10 active:bg-dept-admin/15 transition-all group"
                >
                  <Shield className="w-3.5 h-3.5 text-dept-admin shrink-0" />
                  <span className="text-[12.5px] font-medium text-[var(--text-secondary)] group-hover:text-dept-admin">
                    Admin Panel
                  </span>
                </Link>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── Taskbar menu items (Operations, View, Help) ── */}
        <div className="hidden md:flex items-center gap-0.5 ml-1">
        {menuItems.map((item) => {
          if (item === "Operations") {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <NavMenuTrigger item={item} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn("w-60", DROPDOWN_CONTENT)}>
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
                            <Icon className={cn("w-3.5 h-3.5", dept.iconColor)} />
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
                  <NavMenuTrigger item={item} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn("w-52", DROPDOWN_CONTENT)}>
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
                          <Icon className={cn("w-4 h-4 shrink-0", tool.colorClass)} />
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
                        className="w-4 h-4 shrink-0 text-dept-drilling fill-current"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </svg>
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        GitHub Workspace
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item === "View") {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <NavMenuTrigger item={item} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn("w-48", DROPDOWN_CONTENT)}>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                    onClick={() => window.location.reload()}
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
                      Reload
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌘R</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5 flex items-center gap-2.5 px-2 py-1.5"
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      } else if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
                      Toggle Fullscreen
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌃⌘F</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item === "Help") {
            return (
              <DropdownMenu key={item}>
                <DropdownMenuTrigger asChild>
                  <NavMenuTrigger item={item} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn("w-52", DROPDOWN_CONTENT)}>
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

          return <NavMenuTrigger key={item} item={item} />;
        })}
        </div>
      </nav>

      {/* Center: KDE task strip — search / window slot */}
      <div className="hidden sm:flex min-w-0 flex-1 items-center justify-center px-1">
        {centerSlot}
      </div>

      {/* Right: system tray slot */}
      <div className="flex items-center gap-1.5 shrink-0 text-[12px] text-[var(--text-secondary)]">
        {rightSlot}
      </div>
    </motion.div>
  );
}
