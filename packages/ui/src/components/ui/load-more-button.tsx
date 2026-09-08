import * as React from "react";
import { Button, ButtonProps } from "./button";
import { cn } from "../../lib/utils";

export interface LoadMoreButtonProps extends ButtonProps {
  loading?: boolean;
}

const LoadMoreButton = React.forwardRef<HTMLButtonElement, LoadMoreButtonProps>(
  ({ className, loading, children, ...props }, ref) => {
    return (
      <div className="flex justify-center w-full py-4">
        <Button
          ref={ref}
          variant="secondary"
          className={cn("w-full sm:w-auto min-w-[120px]", className)}
          disabled={loading || props.disabled}
          {...props}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading...
            </span>
          ) : (
            children || "Load More"
          )}
        </Button>
      </div>
    );
  },
);
LoadMoreButton.displayName = "LoadMoreButton";

export { LoadMoreButton };
