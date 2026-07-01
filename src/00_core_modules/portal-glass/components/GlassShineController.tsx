"use client";

import { useEffect } from "react";
import { triggerShineRandomly } from "./glass-shine-orchestrator";

/** Mount on auth/login surfaces to run occasional specular shine sweeps. */
export function GlassShineController() {
  useEffect(() => triggerShineRandomly(), []);
  return null;
}
