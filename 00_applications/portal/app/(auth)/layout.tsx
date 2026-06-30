"use client";

import { ChromeAutoHide } from "@/components/system/ChromeAutoHide";
import { AuthAmbientBackground } from "@/components/auth/AuthAmbientBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-auth-stage portal-auth-stage--viewport relative flex flex-1 min-h-0 w-full h-full overflow-hidden">
      <AuthAmbientBackground />
      <div className="portal-layer-panel relative z-[var(--z-primary-card)] flex flex-1 min-h-0 w-full flex-col overflow-hidden">
        <ChromeAutoHide />
        {children}
      </div>
    </div>
  );
}
