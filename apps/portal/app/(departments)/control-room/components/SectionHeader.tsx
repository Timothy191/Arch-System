import { Logo } from '@repo/ui/Logo';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}

export function SectionHeader({ title, subtitle, icon }: SectionHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <Logo className="h-6 w-6 text-accent-gold" />
        {icon && <span className="text-accent-gold">{icon}</span>}
        <h1 className="font-bold text-[var(--text-heading)] text-xl tracking-tight sm:text-2xl">
          {title}
        </h1>
      </div>
      {subtitle && <p className="text-[var(--text-secondary)] text-sm">{subtitle}</p>}
      <div className="h-px w-full bg-[var(--border-default)]" />
    </div>
  );
}
