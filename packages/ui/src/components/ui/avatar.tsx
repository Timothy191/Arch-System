"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  letter?: string;
  username?: string;
  title?: string;
  size?: 16 | 20 | 24 | 32 | 36 | 40 | 48 | 64 | 90 | number;
  placeholder?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<number, { container: string; font: string }> = {
  16: { container: "w-4 h-4", font: "text-[9px]" },
  20: { container: "w-5 h-5", font: "text-[10px]" },
  24: { container: "w-6 h-6", font: "text-xs" },
  32: { container: "w-8 h-8", font: "text-xs font-medium" },
  36: { container: "w-9 h-9", font: "text-xs font-medium" },
  40: { container: "w-10 h-10", font: "text-sm font-medium" },
  48: { container: "w-12 h-12", font: "text-base font-semibold" },
  64: { container: "w-16 h-16", font: "text-xl font-semibold" },
  90: { container: "w-[90px] h-[90px]", font: "text-2xl font-bold" },
};

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    { src, letter, username, title, size = 32, placeholder = false, className, style, ...props },
    ref
  ) => {
    const [imageFailed, setImageFailed] = React.useState(false);

    React.useEffect(() => {
      setImageFailed(false);
    }, [src]);

    // Format initials: uppercase, max 2 chars, alphanumeric only
    const computedLetter = React.useMemo(() => {
      if (letter) {
        return letter
          .replace(/[^A-Za-z0-9]/g, "")
          .slice(0, 2)
          .toUpperCase();
      }
      if (title) {
        const words = title.trim().split(/\s+/).filter(Boolean);
        const first = words[0];
        const second = words[1];
        if (first && second) {
          return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
        }
        if (first) {
          return first.slice(0, 2).toUpperCase();
        }
      }
      if (username) {
        return username.slice(0, 2).toUpperCase();
      }
      return undefined;
    }, [letter, title, username]);

    const sizeConfig =
      typeof size === "number" && SIZE_CLASSES[size]
        ? SIZE_CLASSES[size]
        : { container: "", font: "text-xs" };

    const customSizeStyle: React.CSSProperties =
      !SIZE_CLASSES[size as number] && typeof size === "number"
        ? { width: `${size}px`, height: `${size}px`, minWidth: `${size}px` }
        : {};

    const ariaLabel = title
      ? title
      : computedLetter
        ? `Avatar with initials: ${computedLetter}`
        : "Avatar";

    // 1. Loading Shell / Placeholder state
    if (placeholder && !src && !computedLetter) {
      return (
        <div
          ref={ref}
          role="img"
          aria-label="Loading avatar"
          style={{ ...customSizeStyle, ...style }}
          className={cn(
            "relative rounded-full shrink-0 bg-black/[0.08] dark:bg-white/[0.1] animate-pulse",
            sizeConfig.container,
            className
          )}
          {...props}
        />
      );
    }

    // 2. Image or Letter state
    const canRenderImage = Boolean(src) && !imageFailed;

    return (
      <div
        ref={ref}
        role={canRenderImage ? undefined : "img"}
        aria-label={canRenderImage ? undefined : ariaLabel}
        title={title}
        style={{ ...customSizeStyle, ...style }}
        className={cn(
          "relative rounded-full shrink-0 select-none flex items-center justify-center overflow-hidden",
          "border border-black/[0.08] dark:border-white/[0.12] shadow-sm",
          "bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200",
          sizeConfig.container,
          className
        )}
        {...props}
      >
        {canRenderImage ? (
          <img
            src={src!}
            alt={title ?? ariaLabel}
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover rounded-full"
            loading="lazy"
          />
        ) : computedLetter ? (
          <span
            className={cn(
              "font-medium tracking-wide uppercase leading-none select-none",
              sizeConfig.font
            )}
          >
            {computedLetter}
          </span>
        ) : (
          <svg
            className="w-1/2 h-1/2 text-neutral-400 dark:text-neutral-500"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        )}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
