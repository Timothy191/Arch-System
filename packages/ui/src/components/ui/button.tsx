import { Slot } from '@radix-ui/react-slot';
import { cn } from '@repo/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'border border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-2xs hover:bg-accent hover:text-accent-foreground',
        secondary:
          'border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'border border-transparent hover:bg-accent hover:text-accent-foreground',
        link: 'border border-transparent bg-transparent text-primary underline-offset-4 hover:underline',
        glass:
          'border border-white/40 bg-white/70 text-neutral-900 shadow-xs backdrop-blur-md hover:bg-white/85 active:scale-[0.98]',
      },
      size: {
        // Geist sizes
        tiny: 'h-6 gap-1 px-2 text-[11px] [&>svg]:h-3 [&>svg]:w-3',
        small: 'h-8 gap-1.5 px-3 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5',
        medium: 'h-9 gap-2 px-4 text-sm [&>svg]:h-4 [&>svg]:w-4',
        large: 'h-10 gap-2 px-5 text-sm [&>svg]:h-4 [&>svg]:w-4',

        // Backward-compatible sizes
        default: 'h-9 gap-2 px-4 text-sm [&>svg]:h-4 [&>svg]:w-4',
        sm: 'h-8 gap-1.5 px-3 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5',
        lg: 'h-10 gap-2 px-5 text-sm [&>svg]:h-4 [&>svg]:w-4',
        icon: 'h-9 w-9 p-0 [&>svg]:h-4 [&>svg]:w-4',
      },
      shape: {
        square: 'aspect-square rounded-md p-0',
        circle: 'aspect-square rounded-full p-0',
        rounded: 'rounded-full px-5',
        pill: 'rounded-full px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'medium',
    },
  }
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;
export type ButtonShape = NonNullable<VariantProps<typeof buttonVariants>['shape']>;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'prefix'>,
    Omit<VariantProps<typeof buttonVariants>, 'variant' | 'size' | 'shape'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  type?: 'button' | 'submit' | 'reset' | ButtonVariant;
  typeName?: 'button' | 'submit' | 'reset';
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  svgOnly?: boolean;
  shadow?: boolean;
  loading?: boolean;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size = 'medium',
      shape,
      type = 'button',
      typeName,
      prefix,
      suffix,
      svgOnly = false,
      shadow = false,
      loading = false,
      disabled = false,
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    // Resolve variant: if `variant` is provided, use it; otherwise check if `type` was passed as a variant name
    let resolvedVariant: ButtonVariant = variant ?? 'default';
    const possibleVariants: ButtonVariant[] = [
      'default',
      'secondary',
      'destructive',
      'outline',
      'ghost',
      'link',
      'glass',
    ];
    if (!variant && typeof type === 'string' && possibleVariants.includes(type as ButtonVariant)) {
      resolvedVariant = type as ButtonVariant;
    }

    // Resolve HTML button type attribute (defaults to "button" or `typeName`)
    const htmlButtonType =
      typeName ??
      (possibleVariants.includes(type as ButtonVariant)
        ? 'button'
        : (type as 'button' | 'submit' | 'reset'));

    const Comp = asChild ? Slot : 'button';

    const isInteractiveDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : htmlButtonType}
        disabled={isInteractiveDisabled}
        aria-busy={loading ? 'true' : undefined}
        className={cn(
          buttonVariants({
            variant: resolvedVariant,
            size,
            shape,
          }),
          shadow && 'shadow-lg hover:shadow-xl',
          svgOnly && 'aspect-square p-0',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
        {!loading && prefix && (
          <span className="inline-flex shrink-0 items-center" aria-hidden="true">
            {prefix}
          </span>
        )}
        {children}
        {!loading && suffix && (
          <span className="inline-flex shrink-0 items-center" aria-hidden="true">
            {suffix}
          </span>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

/**
 * ButtonLink: Navigation link with Button visual aesthetics
 */
export interface ButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'prefix'>,
    Omit<VariantProps<typeof buttonVariants>, 'variant' | 'size' | 'shape'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  svgOnly?: boolean;
  shadow?: boolean;
}

export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      className,
      variant = 'default',
      size = 'medium',
      shape,
      prefix,
      suffix,
      svgOnly = false,
      shadow = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <a
        ref={ref}
        className={cn(
          buttonVariants({ variant, size, shape }),
          shadow && 'shadow-lg hover:shadow-xl',
          svgOnly && 'aspect-square p-0',
          className
        )}
        {...props}
      >
        {prefix && (
          <span className="inline-flex shrink-0 items-center" aria-hidden="true">
            {prefix}
          </span>
        )}
        {children}
        {suffix && (
          <span className="inline-flex shrink-0 items-center" aria-hidden="true">
            {suffix}
          </span>
        )}
      </a>
    );
  }
);

ButtonLink.displayName = 'ButtonLink';

/**
 * CustomButton: Button with explicit color state overrides
 */
export interface CustomButtonState {
  foreground?: string;
  background?: string;
  border?: string;
}

export interface CustomButtonProps extends ButtonProps {
  normal?: CustomButtonState;
  hover?: CustomButtonState;
  active?: CustomButtonState;
  width?: number;
}

export const CustomButton = React.forwardRef<HTMLButtonElement, CustomButtonProps>(
  ({ normal, hover, active, width, style, className, children, ...props }, ref) => {
    const customStyle: React.CSSProperties & Record<string, string | number> = { ...style };
    if (width) customStyle.width = `${width}px`;
    if (normal?.background) customStyle.backgroundColor = normal.background;
    if (normal?.foreground) customStyle.color = normal.foreground;
    if (normal?.border) customStyle.borderColor = normal.border;

    return (
      <Button
        ref={ref}
        style={customStyle}
        className={cn(
          'transition-colors',
          hover?.background && `hover:bg-[${hover.background}]`,
          hover?.foreground && `hover:text-[${hover.foreground}]`,
          hover?.border && `hover:border-[${hover.border}]`,
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

CustomButton.displayName = 'CustomButton';

export { Button, buttonVariants };
