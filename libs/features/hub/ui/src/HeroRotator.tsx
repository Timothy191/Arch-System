'use client';

import type { Department } from '@repo/departments/data-access';
import type { Panel } from '@repo/ui/HeroRotator';
import { HeroRotator as GenericHeroRotator } from '@repo/ui/HeroRotator';
import { Logo } from '@repo/ui/Logo';
import { ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';
import { toTitleCase } from './DepartmentCard';

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
      image: '/images/departments/overview.webp',
      video: '/images/departments/overview.mp4',
      icon: <Logo variant="gold" className="h-4 w-4 text-accent-gold" />,
      iconBgColor: 'bg-accent-gold/10',
      primary: { href: primaryHref, label: primaryLabel, icon: arrowIcon },
      secondary: { href: secondaryHref, label: secondaryLabel, icon: arrowIcon },
    };

    const deptPanels = departments.map((dept): Panel => {
      return {
        id: dept.name,
        name: dept.name,
        title: toTitleCase(dept.displayName),
        description: dept.description,
        category: dept.type === 'control_room' ? 'SCADA & Telemetry' : 'Field Operations',
        image:
          dept.name === 'reports'
            ? '/images/departments/control-room.webp'
            : dept.name === 'executive' || dept.name === 'office' || dept.name === 'presentation'
              ? '/images/departments/overview.webp'
              : `/images/departments/${dept.name}.webp`,
        video:
          dept.name === 'reports'
            ? '/images/departments/control-room.mp4'
            : dept.name === 'executive' || dept.name === 'office' || dept.name === 'presentation'
              ? '/images/departments/overview.mp4'
              : `/images/departments/${dept.name}.mp4`,
        stats: dept.stats,
        trend: dept.trend,
        status: dept.status,
        icon: <Logo variant="gold" className="h-4 w-4 text-accent-gold" />,
        iconBgColor: 'bg-accent-gold/10',
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
