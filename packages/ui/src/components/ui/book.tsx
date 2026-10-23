import * as React from 'react';
import { cn } from '../../lib/utils';

export type BookVariant = 'simple' | 'stripe';

export interface ResponsiveWidth {
  default?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export interface BookProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  variant?: BookVariant;
  color?: string;
  textColor?: string;
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  textured?: boolean;
  width?: number | ResponsiveWidth;
  aspectRatio?: string;
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span';
  subtitle?: React.ReactNode;
}

export const Book = React.forwardRef<HTMLDivElement, BookProps>(
  (
    {
      title,
      variant = 'stripe',
      color = '#171717',
      textColor = '#ffffff',
      icon,
      illustration,
      textured = false,
      width = 196,
      aspectRatio = '1 / 1.34',
      headingLevel = 'h3',
      subtitle,
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    // Calculate style variables for responsive width
    const customStyles: React.CSSProperties & Record<string, string | number> = { ...style };
    let widthClasses = '';

    if (typeof width === 'number') {
      customStyles['--book-w'] = `${width}px`;
      widthClasses = 'w-[var(--book-w)]';
    } else if (typeof width === 'object' && width !== null) {
      const defW = width.default ?? width.sm ?? width.md ?? 196;
      customStyles['--book-w'] = `${defW}px`;
      widthClasses = 'w-[var(--book-w)]';

      if (width.sm !== undefined) {
        customStyles['--book-w-sm'] = `${width.sm}px`;
        widthClasses += ' sm:w-[var(--book-w-sm)]';
      }
      if (width.md !== undefined) {
        customStyles['--book-w-md'] = `${width.md}px`;
        widthClasses += ' md:w-[var(--book-w-md)]';
      }
      if (width.lg !== undefined) {
        customStyles['--book-w-lg'] = `${width.lg}px`;
        widthClasses += ' lg:w-[var(--book-w-lg)]';
      }
      if (width.xl !== undefined) {
        customStyles['--book-w-xl'] = `${width.xl}px`;
        widthClasses += ' xl:w-[var(--book-w-xl)]';
      }
    }

    const renderHeading = (content: React.ReactNode) => {
      const headingClasses =
        'text-xs sm:text-sm font-semibold leading-snug tracking-tight text-balance';
      const headingStyle: React.CSSProperties = { color: textColor };

      switch (headingLevel) {
        case 'h1':
          return (
            <h1 className={headingClasses} style={headingStyle}>
              {content}
            </h1>
          );
        case 'h2':
          return (
            <h2 className={headingClasses} style={headingStyle}>
              {content}
            </h2>
          );
        case 'h4':
          return (
            <h4 className={headingClasses} style={headingStyle}>
              {content}
            </h4>
          );
        case 'h5':
          return (
            <h5 className={headingClasses} style={headingStyle}>
              {content}
            </h5>
          );
        case 'h6':
          return (
            <h6 className={headingClasses} style={headingStyle}>
              {content}
            </h6>
          );
        case 'span':
          return (
            <span className={headingClasses} style={headingStyle}>
              {content}
            </span>
          );
        default:
          return (
            <h3 className={headingClasses} style={headingStyle}>
              {content}
            </h3>
          );
      }
    };

    return (
      <div
        ref={ref}
        role="group"
        aria-label={typeof title === 'string' ? `Book: ${title}` : 'Book'}
        className={cn(
          'relative shrink-0 select-none overflow-hidden rounded-r-md rounded-l-sm transition-transform duration-200',
          'shadow-[0_4px_16px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.12),-2px_0_4px_rgba(0,0,0,0.08),2px_0_6px_rgba(0,0,0,0.06)]',
          'border-y border-y-black/10 border-r-2 border-r-white/20',
          widthClasses,
          className
        )}
        style={{
          backgroundColor: color,
          color: textColor,
          aspectRatio,
          ...customStyles,
        }}
        {...props}
      >
        {/* Book Spine Crease & Shadow (Left edge binding simulation) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-4"
          style={{
            background:
              'linear-gradient(to right, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.12) 35%, rgba(255,255,255,0.2) 70%, rgba(0,0,0,0.12) 100%)',
          }}
        />

        {/* Textured Overlay (Optional realistic lighting sheen & subtle grain) */}
        {textured && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 opacity-40 mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"), linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 60%, rgba(0,0,0,0.25) 100%)`,
            }}
          />
        )}

        {/* Ambient Top Sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 opacity-30"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)',
          }}
        />

        {/* Inner Cover Content */}
        <div className="relative z-10 flex h-full flex-col justify-between py-3.5 pr-3.5 pl-6">
          {/* Top / Stripe Header Area */}
          {variant === 'stripe' ? (
            <div className="space-y-2">
              <div
                className="inline-flex items-center gap-2 rounded bg-black/20 px-2 py-1 text-xs backdrop-blur-xs"
                style={{ color: textColor }}
              >
                {icon && (
                  <span aria-hidden="true" className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
                    {icon}
                  </span>
                )}
                <span className="font-mono text-[10px] uppercase tracking-wider opacity-85">
                  Volume
                </span>
              </div>
            </div>
          ) : (
            <div>
              {icon && (
                <div
                  aria-hidden="true"
                  className="mb-2 shrink-0 opacity-90 [&>svg]:h-4 [&>svg]:w-4"
                >
                  {icon}
                </div>
              )}
            </div>
          )}

          {/* Center Graphic / Illustration Slot */}
          {illustration && (
            <div
              aria-hidden="true"
              className="my-auto flex max-h-[45%] items-center justify-center overflow-hidden opacity-90"
            >
              {illustration}
            </div>
          )}

          {/* Bottom Title & Subtitle Area */}
          <div className="mt-auto space-y-1 pt-2">
            {renderHeading(title)}
            {subtitle && (
              <p
                className="line-clamp-1 font-mono text-[10px] uppercase tracking-wider opacity-75"
                style={{ color: textColor }}
              >
                {subtitle}
              </p>
            )}
            {children}
          </div>
        </div>
      </div>
    );
  }
);

Book.displayName = 'Book';
