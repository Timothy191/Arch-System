"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

export interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  textToCopy: string;
  label?: string;
  size?: "small" | "medium" | "large";
  timeout?: number;
}

export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      textToCopy,
      label = "copy text",
      size = "medium",
      timeout = 2000,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(textToCopy);
          setCopied(true);
        }
      } catch (err) {
        console.error("Failed to copy text:", err);
      }
    };

    React.useEffect(() => {
      if (!copied) return;
      const timer = setTimeout(() => {
        setCopied(false);
      }, timeout);
      return () => clearTimeout(timer);
    }, [copied, timeout]);

    const sizeClasses =
      size === "small"
        ? "h-7 w-7 text-xs"
        : size === "large"
          ? "h-10 w-10 text-base"
          : "h-8 w-8 text-sm";

    const iconSize = size === "small" ? "h-3.5 w-3.5" : size === "large" ? "h-5 w-5" : "h-4 w-4";

    return (
      <button
        ref={ref}
        type="button"
        aria-label={copied ? "Copied" : label}
        title={copied ? "Copied" : label}
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 transition-all duration-150 hover:bg-neutral-50 hover:text-neutral-900 active:scale-95 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
          sizeClasses,
          copied &&
            "border-green-500/50 text-green-600 dark:border-green-500/50 dark:text-green-400",
          className
        )}
        {...props}
      >
        {copied ? (
          <Check className={cn(iconSize, "stroke-[2.5] animate-in zoom-in-50 duration-150")} />
        ) : (
          <Copy className={iconSize} />
        )}
      </button>
    );
  }
);

CopyButton.displayName = "CopyButton";
