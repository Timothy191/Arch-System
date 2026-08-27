"use client";

import { useMemo } from "react";
import {
  Layers,
  TrendingUp,
  ScanFace,
  CreditCard,
  Wrench,
  TowerControl,
  HardHat,
  GraduationCap,
  Orbit,
  Pickaxe,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Logo } from "@repo/ui/Logo";
import { ThreeHeroRotatorDynamic as GenericHeroRotator } from "@repo/ui/ThreeHeroRotatorDynamic";
import type { Panel } from "@repo/ui/HeroRotator";
import type { Department } from "@repo/departments/data-access";

export interface HeroRotatorProps {
  defaultTitle: string;
  defaultDescription: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  departments: Department[];
  incidentCount?: number;
  breakdownCount?: number;
  offlineMachineCount?: number;
}

const DEPT_STYLE_MAP: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; iconColor: string; bgColor: string }
> = {
  drilling: { icon: Pickaxe, iconColor: "text-dept-drilling", bgColor: "bg-dept-drilling/10" },
  production: {
    icon: TrendingUp,
    iconColor: "text-dept-production",
    bgColor: "bg-dept-production/10",
  },
  "access-control": {
    icon: ScanFace,
    iconColor: "text-dept-access-control",
    bgColor: "bg-dept-access-control/10",
  },
  "access-card-actions": {
    icon: CreditCard,
    iconColor: "text-dept-access-card-actions",
    bgColor: "bg-dept-access-card-actions/10",
  },
  engineering: {
    icon: Wrench,
    iconColor: "text-dept-engineering",
    bgColor: "bg-dept-engineering/10",
  },
  "control-room": {
    icon: TowerControl,
    iconColor: "text-dept-control-room",
    bgColor: "bg-dept-control-room/10",
  },
  safety: { icon: HardHat, iconColor: "text-dept-safety", bgColor: "bg-dept-safety/10" },
  training: {
    icon: GraduationCap,
    iconColor: "text-dept-training",
    bgColor: "bg-dept-training/10",
  },
  "satellite-monitoring": {
    icon: Orbit,
    iconColor: "text-dept-satellite",
    bgColor: "bg-dept-satellite/10",
  },
};

export function HeroRotator({
  defaultTitle,
  defaultDescription,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  departments,
  incidentCount = 0,
  breakdownCount = 0,
  offlineMachineCount = 0,
}: HeroRotatorProps) {
  const panels = useMemo<Panel[]>(() => {
    const arrowIcon = <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />;

    const overviewPanel: Panel = {
      id: "overview",
      name: "overview",
      title: defaultTitle,
      description: defaultDescription,
      category: "Central Command",
      image: "/images/departments/overview.jpg",
      stats: { label: "System Health", value: "100% Optimal" },
      status: "active",
      icon: <Logo className="w-4 h-4 text-[var(--accent-blue)]" />,
      iconBgColor: "bg-[var(--accent-blue)]/10",
      primary: { href: primaryHref, label: primaryLabel, icon: arrowIcon },
      secondary: { href: secondaryHref, label: secondaryLabel, icon: arrowIcon },
    };

    const deptPanels = departments.map((dept): Panel => {
      const style = DEPT_STYLE_MAP[dept.name] || {
        icon: Layers,
        iconColor: "text-[var(--accent-blue)]",
        bgColor: "bg-[var(--accent-blue)]/10",
      };
      const DeptIcon = style.icon;

      return {
        id: dept.name,
        name: dept.name,
        title: dept.displayName,
        description: dept.description,
        category:
          dept.type === "control_room"
            ? "SCADA & Telemetry"
            : dept.type === "satellite"
              ? "Orbital Intelligence"
              : "Field Operations",
        image: `/images/departments/${dept.name}.jpg`,
        stats: dept.stats || { label: "Telemetry", value: "Online" },
        status: dept.status || "active",
        icon: <DeptIcon className={cn("w-4 h-4", style.iconColor)} />,
        iconBgColor: style.bgColor,
        primary: dept.actions?.[0]
          ? { href: dept.actions[0].href, label: dept.actions[0].label, icon: arrowIcon }
          : { href: `/${dept.name}`, label: `Launch ${dept.displayName}`, icon: arrowIcon },
        secondary: dept.actions?.[1]
          ? { href: dept.actions[1].href, label: dept.actions[1].label, icon: arrowIcon }
          : undefined,
      };
    });

    return [overviewPanel, ...deptPanels];
  }, [
    defaultTitle,
    defaultDescription,
    primaryHref,
    primaryLabel,
    secondaryHref,
    secondaryLabel,
    departments,
  ]);

  return (
    <GenericHeroRotator
      panels={panels}
      incidentCount={incidentCount}
      breakdownCount={breakdownCount}
      offlineMachineCount={offlineMachineCount}
    />
  );
}
