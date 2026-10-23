import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { GlassCard } from '../GlassCard';

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  subtitle?: string;
  status?: 'nominal' | 'warning' | 'critical';
  className?: string;
  onClick?: () => void;
}

export const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      className,
      title,
      value,
      unit,
      change,
      changeLabel,
      trend,
      icon,
      subtitle,
      status = 'nominal',
      onClick,
    },
    ref
  ) => {
    const isPositive = change !== undefined ? change > 0 : trend === 'up';
    const isNegative = change !== undefined ? change < 0 : trend === 'down';
    const isNeutral =
      change !== undefined ? change === 0 : trend === 'neutral' || trend === undefined;

    return (
      <GlassCard
        ref={ref}
        variant="default"
        onClick={onClick}
        className={cn(
          'select-none p-4 transition-all duration-150 hover:shadow-md',
          status === 'warning' && 'border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/[0.02]',
          status === 'critical' && 'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/[0.02]',
          className
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate font-medium text-[var(--text-secondary)] text-xs uppercase tracking-wider">
            {title}
          </span>
          {icon && (
            <div className="shrink-0 rounded-lg bg-black/[0.04] p-1.5 text-[var(--text-secondary)]">
              {icon}
            </div>
          )}
        </div>

        <div className="my-1 flex items-baseline gap-1.5">
          <span className="font-bold font-mono text-2xl text-[var(--text-heading)] tabular-nums tracking-tight">
            {value}
          </span>
          {unit && <span className="font-medium text-[var(--text-secondary)] text-xs">{unit}</span>}
        </div>

        {(change !== undefined || subtitle) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {change !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium tabular-nums',
                  isPositive && 'text-[var(--accent-green)]',
                  isNegative && 'text-[var(--accent-red)]',
                  isNeutral && 'text-[var(--text-secondary)]'
                )}
              >
                {isPositive && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
                {isNegative && <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
                {isNeutral && <Minus className="h-3.5 w-3.5" aria-hidden="true" />}
                {Math.abs(change)}%
              </span>
            )}
            {(changeLabel || subtitle) && (
              <span className="truncate text-[var(--text-secondary)]">
                {changeLabel ?? subtitle}
              </span>
            )}
          </div>
        )}
      </GlassCard>
    );
  }
);
MetricCard.displayName = 'MetricCard';
