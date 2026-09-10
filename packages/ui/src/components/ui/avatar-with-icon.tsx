"use client";

import type * as React from "react";
import { cn } from "../../lib/utils";
import { Avatar, type AvatarProps } from "./avatar";

export interface AvatarWithIconProps extends AvatarProps {
  icon: React.ReactNode;
  iconBackground?: boolean;
  iconPosition?: "bottom-right" | "top-right";
}

export function AvatarWithIcon({
  icon,
  iconBackground = true,
  iconPosition = "bottom-right",
  size = 32,
  className,
  ...avatarProps
}: AvatarWithIconProps): React.JSX.Element {
  const iconSizeClass =
    size <= 24
      ? "w-3 h-3 text-[8px]"
      : size <= 32
        ? "w-4 h-4 text-[10px]"
        : size <= 48
          ? "w-5 h-5 text-xs"
          : "w-6 h-6 text-sm";

  const positionClass =
    iconPosition === "top-right" ? "-top-0.5 -right-0.5" : "-bottom-0.5 -right-0.5";

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <Avatar size={size} {...avatarProps} />
      <div
        className={cn(
          "absolute flex items-center justify-center rounded-full z-10 select-none",
          positionClass,
          iconSizeClass,
          iconBackground && "bg-white ring-2 ring-white border border-black/10 shadow-sm",
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
    </div>
  );
}

AvatarWithIcon.displayName = "AvatarWithIcon";
