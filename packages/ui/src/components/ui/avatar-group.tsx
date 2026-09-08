"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Avatar, type AvatarProps } from "./avatar";

export interface AvatarMember {
  username?: string;
  src?: string | null;
  letter?: string;
  title?: string;
}

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  members: AvatarMember[];
  limit?: number;
  size?: 16 | 20 | 24 | 32 | 36 | 40 | 48 | 64 | number;
  reverse?: boolean;
  overlap?: "auto" | number;
  className?: string;
}

export function AvatarGroup({
  members = [],
  limit,
  size = 32,
  reverse = false,
  overlap = "auto",
  className,
  ...props
}: AvatarGroupProps): React.JSX.Element {
  const visibleMembers = typeof limit === "number" && limit > 0 ? members.slice(0, limit) : members;

  const overflowCount =
    typeof limit === "number" && limit > 0 ? Math.max(0, members.length - limit) : 0;

  // Calculate negative margin for overlap
  const computedMarginLeft = React.useMemo(() => {
    if (typeof overlap === "number") {
      return `-${overlap}px`;
    }
    // "auto" overlap: approximately ~28% to 33% of avatar diameter
    const offset = Math.round(size * 0.28);
    return `-${offset}px`;
  }, [overlap, size]);

  const groupLabel = `Group of ${members.length} people`;

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn("flex items-center isolate", className)}
      {...props}
    >
      {visibleMembers.map((member, index) => {
        // Stacking order:
        // Default (reverse=false): first member sits on top (highest z-index)
        // Reverse (reverse=true): last member sits on top
        const zIndex = reverse ? index + 1 : visibleMembers.length - index;

        const isFirst = index === 0;

        return (
          <div
            key={member.username ?? member.title ?? index}
            style={{
              zIndex,
              marginLeft: isFirst ? undefined : computedMarginLeft,
            }}
            className="transition-transform hover:z-30 hover:scale-105"
          >
            <Avatar
              size={size}
              src={member.src}
              letter={member.letter}
              username={member.username}
              title={member.title ?? member.username}
              className="ring-2 ring-white dark:ring-neutral-950"
            />
          </div>
        );
      })}

      {overflowCount > 0 && (
        <div
          style={{
            zIndex: reverse ? visibleMembers.length + 1 : 0,
            marginLeft: computedMarginLeft,
            width: `${size}px`,
            height: `${size}px`,
            minWidth: `${size}px`,
          }}
          className={cn(
            "relative rounded-full shrink-0 select-none flex items-center justify-center font-medium",
            "ring-2 ring-white dark:ring-neutral-950 border border-black/[0.08] dark:border-white/[0.12]",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300",
            size <= 24 ? "text-[10px]" : "text-xs",
          )}
          title={`+${overflowCount} more`}
          aria-label={`+${overflowCount} more members`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}

AvatarGroup.displayName = "AvatarGroup";
