"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ProductionTrendChartProps } from "./ProductionTrendChart";

export const ProductionTrendChart: ComponentType<ProductionTrendChartProps> =
  dynamic(
    () => import("./ProductionTrendChart").then((m) => m.ProductionTrendChart),
    {
      ssr: false,
      loading: () => (
        <div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-xl" />
      ),
    },
  );
