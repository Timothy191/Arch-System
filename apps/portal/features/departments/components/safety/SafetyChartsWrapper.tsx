"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { SafetyChartsProps } from "./SafetyCharts";

export const SafetyCharts: ComponentType<SafetyChartsProps> = dynamic(
  () => import("./SafetyCharts").then((m) => m.SafetyCharts),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-xl" />
    ),
  },
);
