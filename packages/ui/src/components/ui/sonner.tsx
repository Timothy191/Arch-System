"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--bg-secondary)] group-[.toaster]:text-[var(--text-heading)] group-[.toaster]:border-[var(--border-default)] group-[.toaster]:shadow-diffusion-md",
          description: "group-[.toast]:text-[var(--text-muted)]",
          actionButton: "group-[.toast]:bg-[var(--accent-blue)] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-[var(--bg-tertiary)] group-[.toast]:text-[var(--text-muted)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
