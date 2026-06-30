"use client";

import { useChromeAutoHide } from "@/hooks/useChromeAutoHide";
import "./chrome-auto-hide.css";

/** Activates bottom agent-bar auto-hide for auth routes (KDE taskbar stays visible). */
export function ChromeAutoHide() {
  useChromeAutoHide();
  return null;
}
