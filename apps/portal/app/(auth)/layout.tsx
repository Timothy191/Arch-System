"use client";

import { ChromeAutoHide } from "@/components/system/ChromeAutoHide";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-28px)] w-full h-full flex overflow-hidden">
      <ChromeAutoHide />
      {children}
    </div>
  );
}
