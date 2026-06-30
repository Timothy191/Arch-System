"use client";

import { ChromeAutoHide } from "@/components/system/ChromeAutoHide";
import { AuthAmbientBackground } from "@/components/auth/AuthAmbientBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-auth-stage relative min-h-[calc(100vh-4rem)] w-full h-full overflow-hidden">
      <AuthAmbientBackground />
      <div className="portal-layer-panel relative z-[var(--z-primary-card)] flex min-h-[calc(100vh-4rem)] w-full flex-col">
        <ChromeAutoHide />
        {children}
      </div>
    </div>
  );
}
