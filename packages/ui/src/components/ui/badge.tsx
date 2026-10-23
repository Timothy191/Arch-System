import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center rounded-full border font-medium leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Shadcn backward-compatible
        default: 'border-transparent bg-neutral-900 text-white',
        secondary: 'border-transparent bg-neutral-100 text-neutral-900',
        destructive: 'border-transparent bg-red-600 text-white',
        outline: 'border-neutral-200 text-neutral-900',

        // Geist solid variants
        gray: 'border-transparent bg-neutral-900 text-white',
        blue: 'border-transparent bg-blue-600 text-white',
        purple: 'border-transparent bg-purple-600 text-white',
        amber: 'border-transparent bg-amber-500 text-black',
        red: 'border-transparent bg-red-600 text-white',
        pink: 'border-transparent bg-pink-600 text-white',
        green: 'border-transparent bg-emerald-600 text-white',
        teal: 'border-transparent bg-teal-600 text-white',
        inverted: 'border-transparent bg-neutral-900 text-white shadow-sm',

        // Geist subtle variants
        'gray-subtle': 'border-neutral-200/80 bg-neutral-100 text-neutral-600',
        'blue-subtle': 'border-blue-200/70 bg-blue-50 text-blue-700',
        'purple-subtle': 'border-purple-200/70 bg-purple-50 text-purple-700',
        'amber-subtle': 'border-amber-200/70 bg-amber-50 text-amber-700',
        'red-subtle': 'border-red-200/70 bg-red-50 text-red-700',
        'pink-subtle': 'border-pink-200/70 bg-pink-50 text-pink-700',
        'green-subtle': 'border-emerald-200/70 bg-emerald-50 text-emerald-700',
        'teal-subtle': 'border-teal-200/70 bg-teal-50 text-teal-700',

        // Special branded variants
        trial:
          'border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-sm',
        turbo:
          'border-transparent bg-gradient-to-r from-red-500 via-pink-500 to-blue-500 font-semibold text-white shadow-sm',

        // Interactive link / filter pill
        pill: 'cursor-pointer border-neutral-200 bg-white text-neutral-700 shadow-sm hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98]',
      },
      size: {
        sm: 'h-5 gap-1 px-1.5 text-[11px] [&>svg]:h-3 [&>svg]:w-3',
        md: 'h-6 gap-1.5 px-2 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5',
        lg: 'h-7 gap-2 px-2.5 text-sm [&>svg]:h-4 [&>svg]:w-4',
      },
    },
    defaultVariants: {
      variant: 'gray',
      size: 'md',
    },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
export type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>['size']>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof badgeVariants>, 'variant'> {
  variant?: BadgeVariant;
  contrast?: 'low' | 'high';
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'gray', contrast, size = 'md', icon, children, ...props }, ref) => {
    // If contrast="low", automatically map base colors to their -subtle variant
    let resolvedVariant = variant;
    if (contrast === 'low') {
      if (['gray', 'blue', 'purple', 'amber', 'red', 'pink', 'green', 'teal'].includes(variant)) {
        resolvedVariant = `${variant}-subtle` as BadgeVariant;
      }
    }

    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant: resolvedVariant, size }), className)}
        {...props}
      >
        {icon && (
          <span className="flex shrink-0 items-center justify-center" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { badgeVariants };
