import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

const alertVariants = cva(
  'gold-steel-border gold-steel-border-slim relative w-full rounded-xl border p-4 transition-all duration-150 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg]:text-current [&>svg~*]:pl-8',
  {
    variants: {
      variant: {
        default:
          'border-black/[0.08] bg-white/80 text-[var(--text-heading)] shadow-xs backdrop-blur-md',
        info: 'border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/5 text-[var(--accent-blue)] [&>svg]:text-[var(--accent-blue)]',
        success:
          'border-[var(--accent-green)]/20 bg-[var(--accent-green)]/5 text-[var(--accent-green)] [&>svg]:text-[var(--accent-green)]',
        warning:
          'border-[var(--accent-amber)]/20 bg-[var(--accent-amber)]/5 text-[var(--accent-amber)] [&>svg]:text-[var(--accent-amber)]',
        destructive:
          'border-[var(--accent-red)]/20 bg-[var(--accent-red)]/5 text-[var(--accent-red)] [&>svg]:text-[var(--accent-red)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, children, ...props }, ref) => {
    const defaultIcon = React.useMemo(() => {
      switch (variant) {
        case 'info':
          return <Info className="h-4 w-4" aria-hidden="true" />;
        case 'success':
          return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
        case 'warning':
          return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
        case 'destructive':
          return <AlertCircle className="h-4 w-4" aria-hidden="true" />;
        default:
          return <Info className="h-4 w-4" aria-hidden="true" />;
      }
    }, [variant]);

    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
        {icon !== undefined ? icon : defaultIcon}
        {children}
      </div>
    );
  }
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-semibold text-[13px] leading-none tracking-tight', className)}
      {...props}
    />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-[var(--text-secondary)] text-xs [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription, AlertTitle, alertVariants };
