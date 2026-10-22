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
          'p-4 transition-all duration-150 hover:shadow-md select-none',
          status === 'warning' && 'border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/[0.02]',
          status === 'critical' && 'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/[0.02]',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider truncate">
            {title}
          </span>
          {icon && (
            <div className="p-1.5 rounded-lg bg-black/[0.04] text-[var(--text-secondary)] shrink-0">
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-1.5 my-1">
          <span className="text-2xl font-bold tracking-tight text-[var(--text-heading)] font-mono tabular-nums">
            {value}
          </span>
          {unit && <span className="text-xs font-medium text-[var(--text-secondary)]">{unit}</span>}
        </div>

        {(change !== undefined || subtitle) && (
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {change !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium tabular-nums',
                  isPositive && 'text-[var(--accent-green)]',
                  isNegative && 'text-[var(--accent-red)]',
                  isNeutral && 'text-[var(--text-secondary)]'
                )}
              >
                {isPositive && <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />}
                {isNegative && <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />}
                {isNeutral && <Minus className="w-3.5 h-3.5" aria-hidden="true" />}
                {Math.abs(change)}%
              </span>
            )}
            {(changeLabel || subtitle) && (
              <span className="text-[var(--text-secondary)] truncate">
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
