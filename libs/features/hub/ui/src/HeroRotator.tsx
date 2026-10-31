'use client';

import type { Department } from '@repo/departments/data-access';
import type { Panel } from '@repo/ui/HeroRotator';
import { HeroRotator as GenericHeroRotator } from '@repo/ui/HeroRotator';
import { Logo } from '@repo/ui/Logo';
import { ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';

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
    const arrowIcon = <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />;

    const overviewPanel: Panel = {
      id: 'central-command',
      name: 'central-command',
      title: defaultTitle,
      description: defaultDescription,
      category: 'Central Command',
      image: '/images/departments/overview.jpg',
      video: '/images/departments/overview.mp4',
      stats: { label: 'System Health', value: '100% Optimal' },
      status: 'active',
      icon: <Logo variant="gold" className="h-4 w-4 text-accent-amber" />,
      iconBgColor: 'bg-accent-amber/10',
      primary: { href: primaryHref, label: primaryLabel, icon: arrowIcon },
      secondary: { href: secondaryHref, label: secondaryLabel, icon: arrowIcon },
      assetOverline: 'CENTRAL COMMAND // SYS-MAIN',
      assetSubtitle: defaultDescription,
    };

    const deptPanels = departments.map((dept): Panel => {
      const assetOverline =
        dept.name === 'admin'
          ? 'ENTERPRISE GOVERNANCE // ADM-CORE'
          : dept.name === 'drilling'
            ? 'FIELD OPERATIONS // UNIT-PV351'
            : dept.name === 'production'
              ? 'EXTRACTION & YIELD // PLANT-EXT01'
              : dept.name === 'plant-processing'
                ? 'WASH PLANT & BENEFICIATION // PLANT-WASH01'
                : dept.name === 'plant-inventory'
                  ? 'STOCKPILE & REAGENTS // PLANT-INV01'
                  : dept.name === 'access-control'
                    ? 'SITE SECURITY // SEC-GATE01'
                    : dept.name === 'engineering'
                      ? 'PLANT MAINTENANCE // WORKSHOP-03'
                      : dept.name === 'control-room'
                        ? 'SCADA & TELEMETRY // DISPATCH-ROOM'
                        : dept.name === 'availability-utilization'
                          ? 'FLEET AVAILABILITY & OEE // FLEET-AV01'
                          : dept.name === 'overview'
                            ? 'SYSTEM ARCHITECTURE // ARCH-OS'
                            : dept.name === 'database'
                              ? 'SUPABASE POSTGRESQL // DB-CORE'
                              : 'FIELD OPERATIONS // MINE-UNIT';

      const assetSubtitle =
        dept.name === 'drilling'
          ? 'Epiroc Pit Viper 351 · Bit Depth Telemetry · Pattern B-14'
          : dept.description;

      return {
        id: dept.name,
        name: dept.name,
        title: dept.displayName,
        description: dept.description,
        assetOverline,
        assetSubtitle,
        category: dept.type === 'control_room' ? 'SCADA & Telemetry' : 'Field Operations',
        image:
          dept.name === 'reports'
            ? '/images/departments/control-room.jpg'
            : `/images/departments/${dept.name}.jpg`,
        video:
          dept.name === 'reports'
            ? '/images/departments/control-room.mp4'
            : `/images/departments/${dept.name}.mp4`,
        stats: dept.stats || { label: 'Telemetry', value: 'Online' },
        status: dept.status || 'active',
        icon: <Logo variant="gold" className="h-4 w-4 text-accent-amber" />,
        iconBgColor: 'bg-accent-amber/10',
        primary: dept.actions?.[0]
          ? { href: dept.actions[0].href, label: dept.actions[0].label, icon: arrowIcon }
          : {
              href: dept.route || `/${dept.name}`,
              label: `Launch ${dept.displayName}`,
              icon: arrowIcon,
            },
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
