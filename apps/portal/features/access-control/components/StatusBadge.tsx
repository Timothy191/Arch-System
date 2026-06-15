"use client";

import React from "react";

export type AccessStatus =
  | "Granted"
  | "Denied"
  | "Expired Credential"
  | "Tailgate Alert"
  | "Active"
  | "Expiring Soon"
  | "Expired"
  | "Revoked"
  | "Draft";

const statusConfig: Record<
  AccessStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  Granted: {
    bg: "bg-success/10",
    text: "text-success",
    dot: "bg-success",
    label: "Granted",
  },
  Denied: {
    bg: "bg-danger/10",
    text: "text-danger",
    dot: "bg-danger",
    label: "Denied",
  },
  "Expired Credential": {
    bg: "bg-danger/10",
    text: "text-danger",
    dot: "bg-danger",
    label: "Expired Cred.",
  },
  "Tailgate Alert": {
    bg: "bg-warning/10",
    text: "text-warning",
    dot: "bg-warning",
    label: "Tailgate",
  },
  Active: {
    bg: "bg-success/10",
    text: "text-success",
    dot: "bg-success",
    label: "Active",
  },
  "Expiring Soon": {
    bg: "bg-warning/10",
    text: "text-warning",
    dot: "bg-warning",
    label: "Expiring Soon",
  },
  Expired: {
    bg: "bg-danger/10",
    text: "text-danger",
    dot: "bg-danger",
    label: "Expired",
  },
  Revoked: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    label: "Revoked",
  },
  Draft: {
    bg: "bg-secondary",
    text: "text-secondary-foreground",
    dot: "bg-muted-foreground",
    label: "Draft",
  },
};

interface StatusBadgeProps {
  status: AccessStatus;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig["Draft"];
  const sizeClass =
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClass} ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}
