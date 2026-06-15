"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";
import { useFocusMode } from "@/hooks/useFocusMode";
import {
  LayoutDashboard,
  Drill,
  Factory,
  ShieldCheck,
  Wrench,
  Radar,
  HardHat,
  GraduationCap,
  Satellite,
  Shield,
  Briefcase,
  Bot,
  Workflow,
  CheckSquare,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/ui/components/ui/dropdown-menu";

/* ─────────────────────────────── Data ─────────────────────────────── */

const DEPARTMENTS_LIST = [
  {
    name: "drilling",
    displayName: "Drilling Operations",
    icon: Drill,
    color: "text-accent-blue",
  },
  {
    name: "production",
    displayName: "Production Tracking",
    icon: Factory,
    color: "text-accent-green",
  },
  {
    name: "access-control",
    displayName: "Access Control",
    icon: ShieldCheck,
    color: "text-sky-600",
  },
  {
    name: "engineering",
    displayName: "Engineering",
    icon: Wrench,
    color: "text-violet-600",
  },
  {
    name: "control-room",
    displayName: "SCADA Control Room",
    icon: Radar,
    color: "text-accent-red",
  },
  {
    name: "safety",
    displayName: "Safety Compliance",
    icon: HardHat,
    color: "text-accent-amber",
  },
  {
    name: "training",
    displayName: "Training & LMS",
    icon: GraduationCap,
    color: "text-cyan-600",
  },
  {
    name: "satellite-monitoring",
    displayName: "Satellite Monitoring",
    icon: Satellite,
    color: "text-indigo-600",
  },
];

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
    icon: CheckSquare,
    colorClass: "text-accent-blue",
  },
  {
    name: "schedule",
    displayName: "Schedule",
    icon: CheckSquare,
    colorClass: "text-rose-500",
  },
  {
    name: "calculations",
    displayName: "Calculations",
    icon: CheckSquare,
    colorClass: "text-violet-500",
  },
  {
    name: "notes",
    displayName: "Notes",
    icon: CheckSquare,
    colorClass: "text-accent-amber",
  },
];

const OUTER_ITEMS = [
  { href: "/", label: "Hub", icon: LayoutDashboard, color: "text-slate-500" },
  {
    href: "/drilling",
    label: "Drilling",
    icon: Drill,
    color: "text-accent-blue",
  },
  {
    href: "/production",
    label: "Production",
    icon: Factory,
    color: "text-accent-green",
  },
  {
    href: "/access-control",
    label: "Access",
    icon: ShieldCheck,
    color: "text-accent-blue",
  },
  {
    href: "/engineering",
    label: "Engineering",
    icon: Wrench,
    color: "text-violet-500",
  },
  {
    href: "/control-room",
    label: "Control",
    icon: Radar,
    color: "text-accent-red",
  },
  {
    href: "/safety",
    label: "Safety",
    icon: HardHat,
    color: "text-accent-blue",
  },
  {
    href: "/training",
    label: "Training",
    icon: GraduationCap,
    color: "text-cyan-500",
  },
  {
    href: "/satellite-monitoring",
    label: "Satellite",
    icon: Satellite,
    color: "text-indigo-500",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    color: "text-violet-500",
  },
];

const INNER_ITEMS = [
  {
    type: "operations" as const,
    label: "Ops",
    icon: Briefcase,
    color: "text-indigo-500",
  },
  {
    type: "tools" as const,
    label: "Tools",
    icon: Wrench,
    color: "text-violet-500",
  },
  {
    href: "http://localhost:5678",
    label: "n8n",
    icon: Workflow,
    color: "text-[#ff6d5a]",
  },
  {
    href: "http://localhost:3001",
    label: "Flowise",
    icon: Bot,
    color: "text-[#3ecf8e]",
  },
];

/* ─────────────────────────── Drag helpers ─────────────────────────── */

const POS_STORAGE_KEY = "arch-dock-pos";
const DRAG_THRESHOLD = 4;

interface DockPosition {
  x: number;
  y: number;
}

function clampDockPosition(pos: DockPosition): DockPosition {
  if (typeof window === "undefined") return pos;
  const margin = 80; // enough for wheel radius
  return {
    x: Math.max(margin, Math.min(window.innerWidth - margin, pos.x)),
    y: Math.max(margin, Math.min(window.innerHeight - margin, pos.y)),
  };
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function getAngle(
  index: number,
  total: number,
  dockPosition:
    | "bottom"
    | "top-right"
    | "top-center"
    | "left-center" = "bottom",
) {
  if (dockPosition === "top-right") {
    // Top-right corner: sweep from 90 degrees (down) to 180 degrees (left)
    const startAngle = Math.PI / 2;
    const sweep = Math.PI / 2;
    return startAngle + (index / Math.max(1, total - 1)) * sweep;
  }
  if (dockPosition === "top-center") {
    // Top-center: sweep downwards from 0 (right) to PI (left)
    const startAngle = 0;
    const sweep = Math.PI;
    return startAngle + (index / Math.max(1, total - 1)) * sweep;
  }
  if (dockPosition === "left-center") {
    // Left-center: sweep into screen from -70 to +70 degrees
    const startAngle = -Math.PI / 2 + 0.22;
    const sweep = Math.PI - 0.44;
    return startAngle + (index / Math.max(1, total - 1)) * sweep;
  }
  // Default bottom: sweep upwards from PI (left) to 2PI (right)
  const sweep = Math.PI;
  return Math.PI + (index / Math.max(1, total - 1)) * sweep;
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function WheelItem({
  item,
  angle,
  radius,
  index,
  isActive,
  onNavigate,
  side = "top",
}: {
  item: (typeof OUTER_ITEMS)[number] | (typeof INNER_ITEMS)[number];
  angle: number;
  radius: number;
  index: number;
  isActive: boolean;
  onNavigate: () => void;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;

  const Icon = item.icon;
  const label = "label" in item ? item.label : "";
  const color = "color" in item ? item.color : "";

  return (
    <motion.div
      initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
      animate={{ x, y, opacity: 1, scale: 1 }}
      exit={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
      transition={{
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
        delay: index * 0.025,
      }}
      className="absolute left-1/2 top-1/2 z-50"
    >
      <div className="-translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
        {"href" in item && item.href !== undefined ? (
          item.href.startsWith("http") ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className={cn(
                "relative flex items-center justify-center w-11 h-11 rounded-full",
                "liquid-glass-light border border-white/40 shadow-window",
                "hover:bg-white/90 active:scale-[0.97]",
                "transition-colors",
              )}
            >
              <Icon className={cn("w-5 h-5", color)} />
              {isActive && (
                <div
                  className={cn(
                    "absolute bottom-1 w-1 h-1 rounded-full bg-current",
                    color,
                  )}
                />
              )}
            </a>
          ) : (
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center justify-center w-11 h-11 rounded-full",
                "liquid-glass-light border border-white/40 shadow-window hover:bg-white/90 active:scale-[0.97]",
                "transition-colors",
                isActive && "ring-1 ring-black/[0.08] bg-white/90",
              )}
            >
              <Icon className={cn("w-5 h-5", color)} />
              {isActive && (
                <div
                  className={cn(
                    "absolute bottom-1 w-1 h-1 rounded-full bg-current",
                    color,
                  )}
                />
              )}
            </Link>
          )
        ) : "type" in item && item.type === "operations" ? (
          <OperationsWheelItem
            onNavigate={onNavigate}
            color={color}
            icon={Icon}
            side={side}
          />
        ) : "type" in item && item.type === "tools" ? (
          <ToolsWheelItem
            onNavigate={onNavigate}
            color={color}
            icon={Icon}
            side={side}
          />
        ) : null}
        <span className="text-[10px] font-medium text-[var(--text-heading)] whitespace-nowrap leading-none">
          {label}
        </span>
      </div>
    </motion.div>
  );
}

function OperationsWheelItem({
  onNavigate,
  color,
  icon: Icon,
  side = "top",
}: {
  onNavigate: () => void;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative flex items-center justify-center w-11 h-11 rounded-full",
            "liquid-glass-light border border-white/40 shadow-window hover:bg-white/90 active:scale-[0.97]",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]",
          )}
        >
          <Icon className={cn("w-5 h-5", color)} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        sideOffset={12}
        align="center"
        className="bg-white/95 backdrop-blur-2xl shadow-window border border-black/[0.08] rounded-xl py-1 w-60 z-[100]"
      >
        {DEPARTMENTS_LIST.map((dept) => {
          const DeptIcon = dept.icon;
          return (
            <DropdownMenuItem
              key={dept.name}
              asChild
              className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
            >
              <Link
                href={`/${dept.name}`}
                onClick={onNavigate}
                className="w-full flex items-center px-2 py-1.5"
              >
                <div className="w-6 h-6 rounded-md flex items-center justify-center mr-2.5 shrink-0 bg-black/[0.03]">
                  <DeptIcon className={cn("w-3.5 h-3.5", dept.color)} />
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

function ToolsWheelItem({
  onNavigate,
  color,
  icon: Icon,
  side = "top",
}: {
  onNavigate: () => void;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative flex items-center justify-center w-11 h-11 rounded-full",
            "liquid-glass-light border border-white/40 shadow-window hover:bg-white/90 active:scale-[0.97]",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]",
          )}
        >
          <Icon className={cn("w-5 h-5", color)} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        sideOffset={12}
        align="center"
        className="bg-white/95 backdrop-blur-2xl shadow-window border border-black/[0.08] rounded-xl py-1 w-52 z-[100]"
      >
        {PRODUCTIVITY_LIST.map((tool) => {
          const ToolIcon = tool.icon;
          return (
            <DropdownMenuItem
              key={tool.name}
              asChild
              className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
            >
              <Link
                href={`/drilling/tools?tab=${tool.name}`}
                onClick={onNavigate}
                className="w-full flex items-center px-2 py-1.5 gap-2.5"
              >
                <ToolIcon className={cn("w-4 h-4 shrink-0", tool.colorClass)} />
                <span className="text-[13px] font-medium text-[var(--text-heading)]">
                  {tool.displayName}
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="bg-black/[0.06] my-1 mx-1" />
        <DropdownMenuItem
          asChild
          className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
        >
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-2 py-1.5"
          >
            <div className="flex items-center gap-2.5">
              <Workflow className="w-4 h-4 shrink-0 text-[#ea4b2a]" />
              <span className="text-[13px] font-medium text-[var(--text-heading)]">
                n8n Workflows
              </span>
            </div>
            <ExternalLink className="h-3 w-3 opacity-40" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="cursor-pointer hover:bg-black/[0.04] focus:bg-black/[0.04] rounded-md mx-1 my-0.5"
        >
          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-2 py-1.5"
          >
            <div className="flex items-center gap-2.5">
              <Bot className="w-4 h-4 shrink-0 text-[#3ecf8e]" />
              <span className="text-[13px] font-medium text-[var(--text-heading)]">
                Flowise AI
              </span>
            </div>
            <ExternalLink className="h-3 w-3 opacity-40" />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────── Main ─────────────────────────── */

export function BottomWidgetBar({
  isMerged = false,
  dockPosition = isMerged ? "top-center" : "bottom",
}: {
  isMerged?: boolean;
  dockPosition?: "bottom" | "top-right" | "top-center" | "left-center";
}) {
  const { enabled: isFocusMode } = useFocusMode();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isTopMerged =
    dockPosition === "top-center" || dockPosition === "top-right";
  const isLeftDocked = dockPosition === "left-center";
  const isFloating = dockPosition === "bottom";

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  /* Close when route changes */
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  /* Click outside to close */
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dock-root]")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  /* Keyboard shortcut */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── Drag state ── */
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<DockPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const suppressNextClick = useRef(false);

  /* Load saved position */
  useEffect(() => {
    if (!isFloating) return;
    try {
      const raw = window.localStorage.getItem(POS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as DockPosition;
        setPos(clampDockPosition(saved));
      }
    } catch {
      /* ignore */
    }
  }, [isFloating]);

  /* Clamp on resize */
  useEffect(() => {
    if (!isFloating) return;
    const onResize = () => {
      setPos((prev) => (prev ? clampDockPosition(prev) : null));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isFloating]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      suppressNextClick.current = false;

      const el = wrapperRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const grabX = e.clientX - (rect.left + rect.width / 2);
      const grabY = e.clientY - (rect.top + rect.height / 2);
      let hasMoved = false;

      setIsDragging(true);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - e.clientX;
        const dy = ev.clientY - e.clientY;
        if (
          !hasMoved &&
          (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
        ) {
          hasMoved = true;
          setIsOpen(false); // close wheel when drag starts
        }
        if (hasMoved) {
          setPos(
            clampDockPosition({
              x: ev.clientX - grabX,
              y: ev.clientY - grabY,
            }),
          );
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setIsDragging(false);
        if (hasMoved) {
          suppressNextClick.current = true;
          setPos((prev) => {
            if (prev) {
              window.localStorage.setItem(
                POS_STORAGE_KEY,
                JSON.stringify(prev),
              );
            }
            return prev;
          });
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [setIsOpen],
  );

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressNextClick.current) {
      e.stopPropagation();
      suppressNextClick.current = false;
    }
  }, []);

  const outerRadius = 150;
  const innerRadius = 82;

  const wrapperStyle =
    isFloating && pos
      ? ({
          left: pos.x,
          top: pos.y,
          transform: "translate(-50%, -50%)",
        } as React.CSSProperties)
      : undefined;

  return (
    <div
      ref={wrapperRef}
      data-dock-root
      onPointerDown={isFloating ? handlePointerDown : undefined}
      onClickCapture={handleClickCapture}
      className={cn(
        isLeftDocked
          ? "fixed left-4 top-1/2 -translate-y-1/2 z-50 flex items-center"
          : isTopMerged
            ? "relative flex items-center z-50"
            : "fixed z-50 hidden md:flex items-end gap-3",
        isFloating &&
          (pos
            ? "touch-none select-none"
            : "bottom-0 left-1/2 -translate-x-1/2"),
        isFloating && isDragging && "cursor-grabbing scale-105",
        isFloating && pos && !isDragging && "cursor-grab",
      )}
      style={isFloating ? wrapperStyle : undefined}
    >
      {/* ── Arch bubble + radial wheel ── */}
      <div className="relative flex flex-col items-center">
        {/* Trigger strip when closed */}
        {isFloating && (
          <div
            className={cn(
              "mb-3 h-1 w-20 rounded-full bg-black/15 transition-opacity duration-300",
              isOpen ? "opacity-0" : "opacity-100",
            )}
          />
        )}

        {/* Bubble button */}
        <div
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          aria-label={isOpen ? "Close dock" : "Open dock"}
          aria-expanded={isOpen}
          className={cn(
            isTopMerged
              ? "relative flex items-center justify-center w-8 h-8 rounded-full bg-black/[0.03] hover:bg-black/[0.06] border border-black/[0.05] transition-all duration-200"
              : isLeftDocked
                ? "relative flex items-center justify-center w-12 h-12 rounded-full liquid-glass-light border border-white/40 shadow-window hover:bg-white/90 active:scale-[0.97] transition-all duration-200"
                : "relative flex items-center justify-center w-14 h-14 rounded-full liquid-glass-light border border-white/40 shadow-window hover:bg-white/90 active:scale-[0.97] transition-all duration-200 translate-y-7",
            isOpen &&
              (isTopMerged
                ? "ring-2 ring-[var(--accent-blue)]/30 bg-black/[0.06]"
                : "ring-2 ring-[var(--accent-blue)]/30 bg-white/90"),
          )}
        >
          <Image
            src={isFocusMode ? "/logo-focused.jpeg" : "/logo.png"}
            alt="Arch"
            width={isTopMerged ? 18 : 28}
            height={isTopMerged ? 18 : 28}
            className={cn(
              isTopMerged ? "w-4.5 h-4.5" : "w-7 h-7",
              "object-contain pointer-events-none select-none",
            )}
            draggable={false}
          />

          {/* ── Radial wheel items ── */}
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Outer ring: Hub + departments + Admin */}
                {OUTER_ITEMS.map((item, i) => {
                  const angle = getAngle(i, OUTER_ITEMS.length, dockPosition);
                  const isActive = pathname
                    ? item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href)
                    : false;
                  const radius = isLeftDocked
                    ? i % 2 === 0
                      ? 145
                      : 180
                    : outerRadius;
                  return (
                    <WheelItem
                      key={item.href}
                      item={item}
                      angle={angle}
                      radius={radius}
                      index={i}
                      isActive={isActive}
                      onNavigate={close}
                      side={isLeftDocked ? "right" : "top"}
                    />
                  );
                })}

                {/* Inner ring: Operations, Tools, n8n, Flowise */}
                {INNER_ITEMS.map((item, i) => {
                  const angle = getAngle(i, INNER_ITEMS.length, dockPosition);
                  const radius = isLeftDocked
                    ? i % 2 === 0
                      ? 82
                      : 108
                    : innerRadius;
                  return (
                    <WheelItem
                      key={item.label}
                      item={item}
                      angle={angle}
                      radius={radius}
                      index={OUTER_ITEMS.length + i}
                      isActive={false}
                      onNavigate={close}
                      side={isLeftDocked ? "right" : "top"}
                    />
                  );
                })}
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
