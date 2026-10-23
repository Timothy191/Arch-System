'use client';

import { cn } from '@repo/ui/lib/utils';
import { BarChart3, Drill, Factory, LayoutDashboard, Radar } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Hub', icon: LayoutDashboard, dept: null },
  { href: '/drilling', label: 'Drilling', icon: Drill, dept: 'drilling' },
  {
    href: '/production',
    label: 'Production',
    icon: Factory,
    dept: 'production',
  },
  {
    href: '/control-room',
    label: 'Control',
    icon: Radar,
    dept: 'control-room',
  },
  { href: '/hub/executive', label: 'Analytics', icon: BarChart3, dept: null },
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
      className="fixed right-0 bottom-0 left-0 z-dock flex border-[var(--border-default)] border-t bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex min-h-[56px] flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 py-2 font-medium text-[10px] transition-colors',
              isActive
                ? 'text-[var(--accent-emerald)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
            )}
          >
            <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-[var(--accent-emerald)]')} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
