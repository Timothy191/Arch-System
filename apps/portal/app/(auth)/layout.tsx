"use client";

import { ChromeAutoHide } from "@/components/system/ChromeAutoHide";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full h-full flex flex-col overflow-hidden">
      <ChromeAutoHide />
      {children}
    </div>
  );
}
