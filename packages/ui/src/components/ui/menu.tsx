import * as React from "react";
import { Lock, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "./dropdown-menu";

export function MenuContainer({ children }: { children: React.ReactNode }) {
  return <DropdownMenu>{children}</DropdownMenu>;
}

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showChevron?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "unstyled";
  size?: "default" | "small" | "large" | "icon";
  svgOnly?: boolean;
  shape?: "square" | "circle";
}

export const MenuButton = React.forwardRef<HTMLButtonElement, MenuButtonProps>(
  (
    { children, showChevron, variant = "default", size, svgOnly, shape, className, ...props },
    ref,
  ) => {
    if (variant === "unstyled") {
      return (
        <DropdownMenuTrigger asChild>
          <button ref={ref} className={cn("outline-none", className)} {...props}>
            {children}
          </button>
        </DropdownMenuTrigger>
      );
    }

    return (
      <DropdownMenuTrigger asChild>
        <Button
          ref={ref}
          variant={variant}
          size={size}
          className={cn(className, svgOnly && "px-2")}
          {...props}
        >
          {children}
          {showChevron && <ChevronDown className="ml-2 h-4 w-4 opacity-50" />}
        </Button>
      </DropdownMenuTrigger>
    );
  },
);
MenuButton.displayName = "MenuButton";

export interface MenuProps {
  children: React.ReactNode;
  width?: number | string;
  align?: "start" | "center" | "end";
  position?: string; // e.g. left-start, converted to side/align
}

export function Menu({ children, width, align = "start", position }: MenuProps) {
  let side: "top" | "right" | "bottom" | "left" = "bottom";
  let resolvedAlign = align;

  if (position) {
    const [pSide, pAlign] = position.split("-");
    if (pSide && ["top", "bottom", "left", "right"].includes(pSide)) {
      side = pSide as any;
    }
    if (pAlign && ["start", "center", "end"].includes(pAlign)) {
      resolvedAlign = pAlign as any;
    }
  }

  return (
    <DropdownMenuContent
      align={resolvedAlign}
      side={side}
      style={{ width: width ? (typeof width === "number" ? `${width}px` : width) : undefined }}
    >
      {children}
    </DropdownMenuContent>
  );
}

export interface MenuItemProps
  extends Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuItem>, "prefix"> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  href?: string;
  type?: "default" | "error";
}

export const MenuItem = React.forwardRef<React.ElementRef<typeof DropdownMenuItem>, MenuItemProps>(
  ({ className, children, prefix, suffix, type, href, onClick, ...props }, ref) => {
    const Component = href ? "a" : "div";

    return (
      <DropdownMenuItem
        ref={ref}
        asChild={!!href}
        onClick={onClick}
        className={cn(
          "cursor-pointer flex items-center w-full",
          type === "error" &&
            "text-red-600 focus:bg-red-100 focus:text-red-700 dark:focus:bg-red-900/30",
          className,
        )}
        {...props}
      >
        <Component href={href} className="w-full flex items-center">
          {prefix && <span className="mr-2 flex items-center justify-center">{prefix}</span>}
          <span className="flex-1 truncate">{children}</span>
          {suffix && <span className="ml-2 flex items-center justify-center">{suffix}</span>}
        </Component>
      </DropdownMenuItem>
    );
  },
);
MenuItem.displayName = "MenuItem";

export const MenuLink = React.forwardRef<React.ElementRef<typeof DropdownMenuItem>, MenuItemProps>(
  (props, ref) => <MenuItem ref={ref} {...props} />,
);
MenuLink.displayName = "MenuLink";

export const MenuItemLocked = React.forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  MenuItemProps
>(({ children, ...props }, ref) => (
  <MenuItem ref={ref} disabled suffix={<Lock className="h-4 w-4 opacity-50" />} {...props}>
    {children}
  </MenuItem>
));
MenuItemLocked.displayName = "MenuItemLocked";

export const MenuDivider = DropdownMenuSeparator;

export function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{title}</DropdownMenuLabel>
      {children}
    </DropdownMenuGroup>
  );
}
