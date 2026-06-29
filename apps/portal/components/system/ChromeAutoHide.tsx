"use client";

import { useChromeAutoHide } from "@/hooks/useChromeAutoHide";
import "./chrome-auto-hide.css";

/** Activates bottom-dock auto-hide for auth routes (top taskbar stays visible). */
export function ChromeAutoHide() {
  useChromeAutoHide();
  return null;
}
