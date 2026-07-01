"use client";

import { Database } from "lucide-react";
import { resolveSupabaseStudioUrl } from "@repo/supabase";
import { cn } from "@repo/ui/lib/utils";
import { GlassCard } from "@repo/ui/GlassCard";

const STUDIO_URL = resolveSupabaseStudioUrl();

export function DatabasePanel() {
  const openStudio = () => {
    window.open(STUDIO_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="h-full">
      <div
        role="link"
        tabIndex={0}
        data-testid="database-panel"
        aria-label="Open Supabase Studio to manage data, migrations and schema"
        onClick={openStudio}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openStudio();
          }
        }}
        className="block h-full interactive-element outline-none uiverse-card group cursor-pointer"
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
                Open Supabase Studio to manage data, migrations &amp; schema
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
