"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Drill, Factory, Radar, HardHat, BarChart3 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Hub", icon: LayoutDashboard, dept: null },
  { href: "/drilling", label: "Drilling", icon: Drill, dept: "drilling" },
  {
    href: "/production",
    label: "Production",
    icon: Factory,
    dept: "production",
  },
  { href: "/safety", label: "Safety", icon: HardHat, dept: "safety" },
  {
    href: "/control-room",
    label: "Control",
    icon: Radar,
    dept: "control-room",
  },
  { href: "/executive", label: "Analytics", icon: BarChart3, dept: null },
];

interface BottomNavProps {
  accessibleDepartments?: string[];
}

export function BottomNav({ accessibleDepartments }: BottomNavProps) {
  const pathname = usePathname();

  const visibleItems =
    accessibleDepartments && accessibleDepartments.length > 0
      ? NAV_ITEMS.filter((item) => !item.dept || accessibleDepartments.includes(item.dept))
      : NAV_ITEMS;

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t border-[var(--border-default)] bg-white/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium transition-colors touch-manipulation",
              isActive
                ? "text-[var(--accent-emerald)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-body)]",
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-[var(--accent-emerald)]")} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
