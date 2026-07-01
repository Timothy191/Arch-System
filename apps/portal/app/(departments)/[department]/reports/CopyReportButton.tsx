"use client";

import { useState } from "react";
import { SecondaryButton } from "@repo/ui/SecondaryButton";
import { Copy, Check } from "lucide-react";

interface CopyReportButtonProps {
  csvContent: string;
}

export function CopyReportButton({ csvContent }: CopyReportButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to copy CSV data to clipboard:", err);
    }
  };

  return (
    <SecondaryButton
      variant="rounded-lg"
      size="sm"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 min-w-[100px] justify-center transition-all duration-300"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-accent-green animate-in fade-in zoom-in-50 duration-200" />
          <span className="text-accent-green">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 text-[var(--text-muted)]" />
          <span>Copy CSV</span>
        </>
      )}
    </SecondaryButton>
  );
}
