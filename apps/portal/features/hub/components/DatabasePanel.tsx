"use client";

import { Database } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { GlassCard } from "@repo/ui/GlassCard";

export function DatabasePanel() {
  return (
    <div className="h-full">
      <a
        href="http://localhost:54323"
        className="block h-full interactive-element outline-none uiverse-card group"
        target="_self"
        rel="noopener noreferrer"
      >
        <GlassCard
          variant="default"
          className="h-full border-arch-border-subtle hover:border-arch-accent-blue/50 transition-all duration-300"
        >
          <div className={cn("uiverse-card-banner", "uiverse-card-banner-database")}>
            <div
              className={cn(
                "uiverse-card-icon-bubble border-arch-border-emphasis/25",
                "border-accent-violet/20 text-accent-violet bg-accent-violet/5",
              )}
            >
              <Database className="w-5 h-5" />
            </div>
          </div>

          <div className="uiverse-card-body">
            <div className="space-y-2">
              <div className="uiverse-card-title-row">
                <h3 className="uiverse-card-title">Database</h3>
              </div>
              <p className="uiverse-card-subtitle">
                Open Supabase Studio to manage data, migrations & schema
              </p>
            </div>
          </div>
        </GlassCard>
      </a>
    </div>
  );
}
