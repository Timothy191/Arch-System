"use client";

import { GlassCard } from "@repo/ui/GlassCard";
import { Settings as SettingsIcon } from "lucide-react";

export function SettingsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-[var(--text-heading)]">
        System Settings
      </h2>

      <GlassCard className="p-12 flex flex-col items-center justify-center text-center">
        <SettingsIcon className="w-16 h-16 text-[var(--text-muted)] mb-4" />
        <h3 className="text-xl font-medium text-[var(--text-heading)] mb-2">
          Settings Coming Soon
        </h3>
        <p className="text-[var(--text-muted)] max-w-md">
          System-wide configuration options will be available here. This may
          include:
        </p>
        <ul className="mt-4 text-left text-[var(--text-muted)] space-y-2 max-w-md">
          <li>• Application-wide preferences</li>
          <li>• Notification settings</li>
          <li>• Integration configurations</li>
          <li>• System maintenance options</li>
        </ul>
      </GlassCard>
    </div>
  );
}
