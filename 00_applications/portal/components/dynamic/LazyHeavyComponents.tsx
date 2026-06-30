/**
 * Central Lazy Loading Wrapper for Heavy UI Components
 *
 * This file provides Next.js dynamic imports for heavy components from @repo/ui
 * to improve initial bundle size and loading performance.
 *
 * Heavy Components:
 * - DataGrid: @revolist/react-datagrid (~500KB) + @revolist/revogrid (~400KB)
 * - WorkflowBuilder: @xyflow/react (~300KB)
 * - TelemetryChart: recharts (~200KB)
 *
 * Total potential bundle savings: ~1.4MB when these components are loaded on-demand
 */

"use client";

import dynamic from "next/dynamic";

// ─────────────────────────────────────────────────────────────
// DATA GRID COMPONENT
// ─────────────────────────────────────────────────────────────
// Usage: Admin dashboards, reporting pages, data-heavy views
// Dependencies: @revolist/react-datagrid, @revolist/revogrid (~900KB total)

export const DataGrid = dynamic(
  () => import("@repo/ui/DataGrid").then((m) => ({ default: m.DataGrid })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64 bg-white/50 border border-black/[0.08] rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-sm text-gray-600">Loading data grid...</span>
      </div>
    ),
    ssr: false, // Don't SSR this heavy component
  },
);

// ─────────────────────────────────────────────────────────────
// WORKFLOW BUILDER COMPONENT
// ─────────────────────────────────────────────────────────────
// Usage: Workflow configuration, automation builders
// Dependencies: @xyflow/react (~300KB)

export const WorkflowBuilder = dynamic(
  () =>
    import("@repo/ui/WorkflowBuilder").then((m) => ({
      default: m.WorkflowBuilder,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64 bg-white/50 border border-black/[0.08] rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        <span className="ml-2 text-sm text-gray-600">Loading workflow builder...</span>
      </div>
    ),
    ssr: false,
  },
);

// ─────────────────────────────────────────────────────────────
// TELEMETRY CHART COMPONENT
// ─────────────────────────────────────────────────────────────
// Usage: Analytics dashboards, monitoring views, charts
// Dependencies: recharts (~200KB)
// NOTE: Temporarily commented out due to TypeScript resolution issues
// Will be added back when TelemetryChart is actually used in the portal

// export const LazyTelemetryChart = dynamic(
//   () => import("@repo/ui/TelemetryChart"),
//   {
//     loading: () => (
//       <div className="flex items-center justify-center h-48 bg-white/50 border border-black/[0.08] rounded-lg">
//         <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
//         <span className="ml-2 text-sm text-gray-600">Loading chart...</span>
//       </div>
//     ),
//     ssr: false,
//   }
// );

// ─────────────────────────────────────────────────────────────
// USAGE EXAMPLE
// ─────────────────────────────────────────────────────────────
/*
import { DataGrid, WorkflowBuilder } from '@/components/dynamic/LazyHeavyComponents';

export default function DashboardPage() {
  return (
    <div>
      <h1>Analytics Dashboard</h1>
      
      // Grid loads when user scrolls to this section
      <DataGrid 
        columns={columns}
        data={tableData}
      />
      
      // Workflow builder loads only when opened
      <WorkflowBuilder initialWorkflow={null} />
    </div>
  );
}
*/
