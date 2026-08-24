"use client";

import dynamic from "next/dynamic";
import type { TrendDataPoint } from "./ProductionTrend";

const ProductionTrendInner = dynamic(
  () => import("./ProductionTrend").then((m) => m.ProductionTrend),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-xl" />,
  },
);

interface ProductionTrendProps {
  data: TrendDataPoint[];
  isFallback?: boolean;
}

export function ProductionTrendWrapper({ data, isFallback }: ProductionTrendProps) {
  return <ProductionTrendInner data={data} isFallback={isFallback} />;
}
